import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import type { PluggableList } from 'unified'
import { unified } from 'unified'

import { remarkImageParams } from '../plugins/remark-image-params'
import { remarkInlineQuote } from '../plugins/remark-inline-quote'
import { remarkListStyle } from '../plugins/remark-list-style'
import { remarkSpoiler } from '../plugins/remark-spoiler'
import { preprocessDisplayMath } from './preprocessors'

/**
 * Custom sanitization schema extending the default GitHub schema.
 * Allows our `<spoiler>` element and KaTeX MathML output while blocking
 * XSS vectors like `<script>`, event handlers, and CSS defacement via `style`.
 *
 * The sanitizer runs BEFORE KaTeX, so KaTeX-generated styles are unaffected.
 */
const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Custom element for spoilers
    'spoiler',
    // MathML tags for accessibility (KaTeX can output these)
    'math',
    'mi',
    'mn',
    'mo',
    'ms',
    'mtext',
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Allow the "label" attribute on the custom <spoiler> element (carries the spoiler's button text)
    spoiler: ['label'],
    // Only allow "language-*" classes (syntax highlighting)
    code: [['className', /^language-/]],
    // Only allow "math-*" classes (remark-math generates "math-inline" and "math-display")
    span: [['className', /^math-/]],
    // Only allow "list-style-*" classes (remark-list-style sets these for custom marker styles)
    ol: [['className', /^list-style-/]],
    ul: [['className', /^list-style-/]],
    // MathML attributes
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
  },
  // Allow media: protocol for user's R2-hosted images
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'media'],
    href: [...(defaultSchema.protocols?.href ?? []), 'media'],
  },
}

/**
 * Remark plugins shared by `<Markdown>` (react-markdown) and the headless
 * validator. Order is significant: directive must run before the directive-
 * consuming plugins (spoiler, list-style, inline-quote) so each `:::name` and
 * `:name[…]` shape has its directive node ready to transform.
 */
export const remarkPlugins: PluggableList = [
  remarkGfm,
  remarkDirective,
  remarkSpoiler,
  remarkListStyle,
  remarkInlineQuote,
  remarkImageParams,
  remarkMath,
  remarkBreaks,
]

/**
 * Rehype plugins shared by `<Markdown>` and the headless validator.
 * `rehype-raw` parses any embedded HTML, `rehype-sanitize` enforces the
 * custom schema, then `rehype-katex` renders math. Sanitize runs BEFORE
 * KaTeX so KaTeX's own attribute output is not stripped.
 */
export const rehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, sanitizeSchema],
  rehypeKatex,
]

/**
 * Builds a unified processor wired with the same plugin set the renderer
 * uses, plus `remark-parse`/`remark-rehype`/`rehype-stringify` (which
 * react-markdown injects internally for the renderer).
 *
 * Note: rehype-katex always handles KaTeX errors by emitting a non-fatal
 * vfile message and rendering a red error span — it does not throw.
 * The validator therefore inspects `file.messages` after processing to
 * detect KaTeX failures.
 *
 * @returns A unified processor that parses markdown, runs the full plugin
 *   pipeline, and stringifies the resulting hast tree to HTML.
 */
function createValidationProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkSpoiler)
    .use(remarkListStyle)
    .use(remarkInlineQuote)
    .use(remarkImageParams)
    .use(remarkMath)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeStringify)
}

/**
 * Pipeline stage at which validation failed.
 */
type ValidationStage = 'parse' | 'sanitize' | 'katex' | 'unknown'

/**
 * Represents a successful validation — the input rendered cleanly through
 * the full pipeline.
 */
type ValidationSuccess = {
  /** The discriminator */
  ok: true
  /** Final HTML output produced by the pipeline */
  html: string
}

/**
 * Represents a failed validation — the pipeline rejected the input at one
 * stage (parse, sanitize, or KaTeX).
 */
type ValidationFailure = {
  /** The discriminator */
  ok: false
  /** Human-readable error message taken from the underlying exception or vfile message */
  error: string
  /** 1-based line number when the underlying error carries position info */
  line?: number
  /** 1-based column number when the underlying error carries position info */
  column?: number
  /** Stage at which the failure occurred */
  stage: ValidationStage
}

/**
 * Result of running `validateMarkdown` against a string — discriminated
 * union representing success or failure.
 */
export type ValidationResult = ValidationSuccess | ValidationFailure

/**
 * Validates a Markdown+TeX string by running it through the same unified
 * pipeline the renderer uses. The text is preprocessed with
 * {@link preprocessDisplayMath} first so `$$...$$` blocks behave the same
 * way they do in the editor.
 *
 * Failures surface in two ways:
 * - Exceptions thrown during processing (rare — typically remark-parse on
 *   unrecoverable input).
 * - vfile messages emitted by plugins that catch their own errors. Notably
 *   `rehype-katex` always reports KaTeX failures as messages with a `katex`
 *   source instead of throwing, so the validator must inspect them.
 *
 * @param text - The Markdown+TeX content to validate.
 *
 * @returns A {@link ValidationResult} indicating success (with the rendered
 *   HTML) or failure (with stage, message, and optional source position).
 */
export async function validateMarkdown(text: string): Promise<ValidationResult> {
  // Mirror the renderer's preprocessing step so display math is detected the same way
  const preprocessed = preprocessDisplayMath(text)

  try {
    // Run the full pipeline
    const file = await createValidationProcessor().process(preprocessed)

    // Plugins that catch their own errors (notably rehype-katex) report failures via vfile messages
    if (file.messages.length > 0) {
      // Pick the first message — KaTeX errors are typically reported one per math expression, and the first one is most actionable
      const message = file.messages[0]!

      // Prefer the wrapped underlying error's message — rehype-katex stores the
      // detailed KaTeX `ParseError` in `cause`, while its own `reason` is a
      // generic "Could not render math with KaTeX". The detailed text is far
      // more useful for diagnosis and for making each snapshot distinguishable.
      const cause = (message as { cause?: unknown }).cause
      const detailed = cause instanceof Error ? cause.message : null

      // Wrap the message into a failure-shaped result with stage classification
      return {
        ok: false,
        error: detailed ?? message.reason ?? message.message,
        line: message.line ?? undefined,
        column: message.column ?? undefined,
        stage: classifyMessageStage(message.source),
      }
    }

    // No messages and no thrown error — pipeline succeeded; return the rendered HTML
    return { ok: true, html: String(file) }
  } catch (error: unknown) {
    // Fall-back path: most plugins emit vfile messages, but anything that genuinely throws lands here
    return classifyThrownError(error)
  }
}

/**
 * Maps a vfile message's `source` field to a {@link ValidationStage}.
 *
 * @param source - The plugin name attached to the vfile message.
 *
 * @returns The validation stage that produced the failure.
 */
function classifyMessageStage(source: string | null | undefined): ValidationStage {
  // rehype-katex tags its messages with source 'rehype-katex'
  if (source === 'rehype-katex') {
    // KaTeX-stage failure — typically a malformed math expression
    return 'katex'
  }

  // rehype-sanitize doesn't usually emit messages (it strips silently), but reserve the bucket
  if (source === 'rehype-sanitize') {
    // Sanitize-stage failure — reserved for future use
    return 'sanitize'
  }

  // Everything else (remark-parse, remark-directive, etc.) is a parse-stage problem
  return 'parse'
}

/**
 * Maps a thrown pipeline error to a {@link ValidationResult}. Used as a
 * fall-back path: most plugins emit vfile messages instead of throwing.
 *
 * @param error - The unknown value caught from the processor.
 *
 * @returns A failure-shaped {@link ValidationResult}.
 */
function classifyThrownError(error: unknown): ValidationResult {
  // Default-shaped error fields
  let message = 'Unknown error'
  let stage: ValidationStage = 'unknown'
  let line: number | undefined
  let column: number | undefined

  // Most thrown values are Error subclasses
  if (error instanceof Error) {
    // Take the message off the Error
    message = error.message

    // KaTeX's ParseError sets name to 'ParseError' and prefixes the message with "KaTeX parse error:"
    if (error.name === 'ParseError' || message.startsWith('KaTeX parse error')) {
      // Bucket as KaTeX failure
      stage = 'katex'
    } else {
      // remark-parse and remark-directive raise messages with positions — bucket as parse
      stage = 'parse'
    }

    // VFileMessage-shaped errors carry line/column on the error object
    const positioned = error as Error & { line?: number; column?: number }

    // Capture line if present
    if (typeof positioned.line === 'number') {
      line = positioned.line
    }

    // Capture column if present
    if (typeof positioned.column === 'number') {
      column = positioned.column
    }
  }

  // Wrap the classified fields into a failure-shaped result
  return { ok: false, error: message, line, column, stage }
}
