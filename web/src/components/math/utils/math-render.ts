import katex from 'katex'

import type { RawContentBlock } from '@/components/features/handouts/handout-content-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { MathGlueReader } from './math-nowrap'
import { MATH_NOWRAP_CLASS, planMathGlue } from './math-nowrap'

/** A run of plain prose between formulas, awaiting HTML-escaping. */
type TextSegment = {
  /** The discriminator. */
  kind: 'text'
  /** The raw (unescaped) prose text. */
  text: string
}

/** A rendered inline formula that still needs its hugging punctuation glued on. */
type InlineMathSegment = {
  /** The discriminator. */
  kind: 'inlineMath'
  /** The KaTeX-rendered inline HTML. */
  html: string
}

/** A rendered display formula occupying its own line. */
type DisplayMathSegment = {
  /** The discriminator. */
  kind: 'displayMath'
  /** The KaTeX-rendered block HTML. */
  html: string
}

/** One classified piece of split math content. */
type ContentSegment = TextSegment | InlineMathSegment | DisplayMathSegment

/** Answers the glue pass's questions about the segments a split string breaks into. */
const SEGMENT_GLUE_READER: MathGlueReader<ContentSegment, InlineMathSegment, never> = {
  isInlineMath: (segment): segment is InlineMathSegment => segment.kind === 'inlineMath',
  readText: (segment) => (segment.kind === 'text' ? segment.text : null),
  isWrapper: (_segment): _segment is never => false,
  readChildren: () => [],
}

/**
 * Flattens a parsed inline content block back to its raw source string, wrapping
 * math nodes in `$...$` / `$$...$$` and recursing through paragraph/bold/italic
 * containers. The result can be fed straight into {@link renderMathContentToHtml}
 * (or a `MathRendererClient`) so text and math render on the same baseline as a
 * single KaTeX-aware string.
 *
 * @param block The inline content block to flatten, or null/undefined if absent.
 *
 * @returns The reconstructed source string, or `''` if the block is absent or unsupported.
 */
export function inlineBlockToMathSource(block: RawContentBlock | null | undefined): string {
  // No block
  if (!block) return ''

  switch (block.type) {
    // Plain text passes through verbatim
    case 'text':
      return block.text
    // Math is wrapped back in delimiters matching its display mode
    case 'math':
      return block.isDisplay ? `$$${block.text}$$` : `$${block.text}$`
    // Container blocks recurse into their children
    case 'paragraph':
    case 'bold':
    case 'italic':
      return block.content.map(inlineBlockToMathSource).join('')
    // Block-level and non-inline types don't appear in inline titles
    case 'link':
    case 'list':
    case 'image':
    case 'quote':
    case 'footnote':
      return ''
    default:
      return assertNever(block)
  }
}

/**
 * Renders a string containing inline ($...$) and display ($$...$$) LaTeX to HTML using KaTeX.
 *
 * - Inline math is rendered with displayMode=false, wrapped together with any
 *   punctuation hugging it so a trailing period or leading bracket can't orphan
 *   onto its own line (see {@link MATH_NOWRAP_CLASS})
 * - Display math is rendered with displayMode=true
 * - Plain text is HTML-escaped to avoid XSS
 */
export function renderMathContentToHtml(content: string): string {
  // Nothing to render for empty or non-string input
  if (!content || typeof content !== 'string') {
    return ''
  }

  try {
    // Split on inline ($...$) and display ($$...$$) delimiters, keeping the matches
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
    const parts = content.split(regex)

    // Escape text destined for raw HTML output (XSS-safe)
    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    // Shared KaTeX options for both inline and display rendering
    const options: katex.KatexOptions = {
      throwOnError: false,
      displayMode: false,
      strict: 'warn',
      trust: false,
      output: 'htmlAndMathml',
      macros: {},
    }

    // Classify each split part into a typed segment, rendering math up front
    const segments: ContentSegment[] = []
    for (const part of parts) {
      // Skip the empty strings split() interleaves
      if (!part) continue

      // Detect the delimiter shape
      const isDisplay = part.startsWith('$$') && part.endsWith('$$')
      const isInline = !isDisplay && part.startsWith('$') && part.endsWith('$')

      // Display math ($$…$$) renders on its own line
      if (isDisplay) {
        // Strip the $$ fence and any surrounding padding
        const body = part.slice(2, -2).trim()
        try {
          // Hand the body to KaTeX in display mode
          const html = katex.renderToString(body, { ...options, displayMode: true })
          segments.push({ kind: 'displayMath', html })
        } catch {
          // Fall back to showing the raw delimited source as text
          segments.push({ kind: 'text', text: part })
        }
      } else if (isInline) {
        // Inline math ($…$): strip the fences
        const body = part.slice(1, -1)
        try {
          // Render inline; the glue pass below adds the hugging punctuation
          const html = katex.renderToString(body, options)
          segments.push({ kind: 'inlineMath', html })
        } catch {
          // Fall back to showing the raw delimited source as text
          segments.push({ kind: 'text', text: part })
        }
      } else {
        // Plain prose between formulas
        segments.push({ kind: 'text', text: part })
      }
    }

    // Glue pass: work out the punctuation hugging each inline formula, so a
    // trailing period or leading bracket can't orphan to its own line
    const glued = planMathGlue(segments, SEGMENT_GLUE_READER)

    // Assemble: escape prose, emit math HTML verbatim, wrap each formula with its glue
    return glued
      .map((item) => {
        switch (item.kind) {
          // Prose renders as whatever a neighbouring formula left of it
          case 'trimmed':
            return escapeHtml(item.text)
          // A formula and its hugging punctuation share one nowrap span
          case 'glued':
            return (
              `<span class="${MATH_NOWRAP_CLASS}">` +
              `${escapeHtml(item.glue.leading)}${item.math.html}${escapeHtml(item.glue.trailing)}` +
              `</span>`
            )
          // A split string is one flat run, so it holds no node the pass walks into
          case 'wrapper':
            return assertNever(item.node)
          // Anything the glue pass left alone is prose or display math
          case 'unchanged':
            switch (item.node.kind) {
              // Prose the author typed, which has to be escaped before it goes out
              case 'text':
                return escapeHtml(item.node.text)
              // Already rendered by KaTeX, so it travels as it stands
              case 'inlineMath':
              case 'displayMath':
                return item.node.html
              default:
                return assertNever(item.node)
            }
          default:
            return assertNever(item)
        }
      })
      .join('')
  } catch {
    // Hand back the unprocessed source so the caller still shows something
    return content
  }
}
