import katex from 'katex'

import type { RawContentBlock } from '@/components/features/handouts/handout-content-types'

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
    // Other block types (links, lists, images, ...) are not expected in inline titles
    default:
      return ''
  }
}

/**
 * Renders a string containing inline ($...$) and display ($$...$$) LaTeX to HTML using KaTeX.
 *
 * - Inline math is rendered with displayMode=false
 * - Display math is rendered with displayMode=true
 * - Plain text is HTML-escaped to avoid XSS
 */
export function renderMathContentToHtml(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  try {
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
    const parts = content.split(regex)

    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const options: katex.KatexOptions = {
      throwOnError: false,
      displayMode: false,
      strict: 'warn',
      trust: false,
      output: 'htmlAndMathml',
      macros: {},
    }

    const rendered: string[] = []
    for (const part of parts) {
      if (!part) continue
      const isDisplay = part.startsWith('$$') && part.endsWith('$$')
      const isInline = !isDisplay && part.startsWith('$') && part.endsWith('$')
      if (isDisplay) {
        const body = part.slice(2, -2).trim()
        try {
          rendered.push(katex.renderToString(body, { ...options, displayMode: true }))
        } catch (error) {
          console.warn('KaTeX display math rendering error:', error)
          rendered.push(escapeHtml(part))
        }
      } else if (isInline) {
        const body = part.slice(1, -1)
        try {
          rendered.push(katex.renderToString(body, options))
        } catch (error) {
          console.warn('KaTeX inline math rendering error:', error)
          rendered.push(escapeHtml(part))
        }
      } else {
        rendered.push(escapeHtml(part))
      }
    }

    return rendered.join('')
  } catch (error) {
    console.error('Math rendering error:', error)
    return content // Return original content if rendering fails
  }
}
