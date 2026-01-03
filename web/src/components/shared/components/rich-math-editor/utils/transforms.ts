/**
 * Text transformation utilities for {@link RichMathEditor}, used for implementing
 * things like making a piece of text bold etc.
 */

/**
 * Context passed to text edit transformers.
 * Contains all information about the current textarea state.
 */
export type EditContext = {
  /** Cursor/selection start position (0-indexed) */
  start: number
  /** Cursor/selection end position (0-indexed) */
  end: number
  /** Currently selected text (empty string if no selection) */
  selectedText: string
  /** Full text content of the textarea */
  fullText: string
}

/**
 * Result of a text transformation operation.
 */
export type EditResult = {
  /** The new complete text content after transformation */
  newText: string
  /** Position where the cursor should be placed after the edit */
  cursorPosition: number
  /** Optional end position for text selection (if different from cursorPos) */
  selectionEnd?: number
}

/**
 * Wraps selected text (or cursor position) with before/after markers.
 * If nothing is selected and a placeholder is provided, inserts the placeholder
 * and returns selection bounds so it can be highlighted for immediate replacement.
 *
 * @param context - The current editor context.
 * @param before - The text to insert before the selection.
 * @param after - The text to insert after the selection (optional).
 * @param placeholder - The placeholder text to insert if nothing is selected (optional).
 *
 * @returns The new text and cursor position.
 */
export function wrapSelection(
  context: EditContext,
  before: string,
  after: string = '',
  placeholder?: string
): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Build the new text with the wrapped selection
  const newText =
    fullText.substring(0, start) +
    before +
    (selectedText || placeholder || '') +
    after +
    fullText.substring(end)

  // If nothing is selected and placeholder provided...
  if (!selectedText && placeholder) {
    // Place cursor at the start of the placeholder
    const cursorPosition = start + before.length

    // Return new context with selected placeholder
    return {
      newText,
      cursorPosition,
      selectionEnd: cursorPosition + placeholder.length,
    }
  }

  // By default place cursor at the end of the selection
  // (which might be empty so the cursor will be at the start)
  return {
    newText,
    cursorPosition: start + before.length + selectedText.length,
  }
}

/**
 * Inserts a line prefix (for quotes and lists). Handles multi-line selections
 * by prefixing each line.
 *
 * @param context - The current editor context.
 * @param prefix - The prefix to insert.
 *
 * @returns The new text and cursor position.
 */
export function insertLinePrefix(context: EditContext, prefix: string): EditResult {
  // Get context data
  const { start, end, fullText } = context

  // When end is at the start of a line, we will exclude that line
  const effectiveEnd = end > start && fullText[end - 1] === '\n' ? end - 1 : end

  // Find start of the first line
  const startLineStart = fullText.lastIndexOf('\n', start - 1) + 1

  // Find end of the last line (index of next newline or end of string)
  const nextNewline = fullText.indexOf('\n', effectiveEnd)
  const endLineEnd = nextNewline === -1 ? fullText.length : nextNewline

  // Extract the text for the affected lines
  const linesText = fullText.substring(startLineStart, endLineEnd)

  // Prefix each line
  const prefixedText = linesText
    .split('\n')
    .map((line) => prefix + line)
    .join('\n')

  // Return new text with prefixed lines and cursor at the end of the affected range
  return {
    newText: fullText.substring(0, startLineStart) + prefixedText + fullText.substring(endLineEnd),
    cursorPosition: startLineStart + prefixedText.length,
  }
}

/**
 * Inserts block/display math with proper newlines.
 * If nothing is selected, inserts a placeholder that can be immediately replaced.
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position.
 */
export function insertBlockMath(context: EditContext): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Get the index of where the line starts
  const lineStart = fullText.lastIndexOf('\n', start - 1) + 1

  // Check if the cursor is at the start/end of the line
  const isAtLineStart = start === lineStart
  const isAtEnd = end === fullText.length

  // Build opening delimiter (with leading newline if needed)
  let before = ''
  if (!isAtLineStart && start > 0) before += '\n'
  before += '$$\n'

  // Build closing delimiter (with trailing newline if not at end)
  let after = '\n$$'
  if (!isAtEnd) after += '\n'

  // Build the text
  const content = selectedText || 'x^2'
  const newText = fullText.substring(0, start) + before + content + after + fullText.substring(end)

  // If something was selected before, we'll not select anything
  // We'll just put the cursor at the start of the inserted content
  if (selectedText) {
    return {
      newText,
      cursorPosition: start + before.length,
    }
  }

  // If nothing was selected before, we'll select the inserted content (the placeholder)
  return {
    newText,
    cursorPosition: start + before.length,
    selectionEnd: start + before.length + content.length,
  }
}

/**
 * Inserts a LaTeX command or symbol with zero, one, or two arguments.
 * Auto-wraps with $...$ if not already in math mode.
 *
 * - For 0-arg symbols (e.g., \alpha, \pi): inserts just the symbol
 * - For 1-arg commands (e.g., \hat, \vec): inserts `\hat{text}` or `\hat{}`
 * - For 2-arg commands (e.g., \frac): inserts `\frac{text}{}` or `\frac{}{}`
 *
 * If text is selected, it becomes the first argument (for 1 or 2 arg commands).
 * Cursor is positioned after the insertion (or inside braces for commands with args).
 *
 * @param context - The current editor context.
 * @param command - The LaTeX command name without backslash (e.g., 'alpha', 'hat', 'frac').
 * @param argCount - Number of arguments (0, 1, or 2). Defaults to 0.
 *
 * @returns The new text and cursor position.
 */
export function insertLatexCommand(
  context: EditContext,
  command: string,
  argCount: 0 | 1 | 2 = 0
): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Get the text before the cursor
  const textBefore = fullText.substring(0, start)

  // Check if we are in math mode
  const inMath = isInMathMode(textBefore)

  // We will build the template based on argument count and selection
  let template: string
  let cursorOffset: number

  // Handle the different argument counts
  switch (argCount) {
    case 0:
      // Simple symbol like \alpha, \pi - no braces
      template = `\\${command}`
      cursorOffset = template.length
      break

    case 1:
      // Single-argument command like \hat{} or \hat{sel}
      template = selectedText ? `\\${command}{${selectedText}}` : `\\${command}{}`

      // Position cursor after selection or inside empty braces
      if (selectedText) {
        // After: \cmd{sel}| -> 1 + cmd.length + 1 + sel.length + 1
        cursorOffset = 1 + command.length + 1 + selectedText.length + 1
      } else {
        // After: \cmd{|} -> inside braces = 1 + cmd.length + 1
        cursorOffset = 1 + command.length + 1
      }
      break

    case 2:
      // Two-argument command like \frac{}{} or \frac{sel}{}
      template = selectedText ? `\\${command}{${selectedText}}{}` : `\\${command}{}{}`

      // Position cursor inside second braces
      // \frac{sel}{}  -> after {sel} and inside second {}
      // \frac{}{}     -> inside first {}
      if (selectedText) {
        // After: \cmd{sel}{|} -> backslash + cmd + { + sel + }{ = 1 + cmd.length + 1 + sel.length + 2
        cursorOffset = 1 + command.length + 1 + selectedText.length + 2
      } else {
        // After: \cmd{|}{} -> inside first braces = 1 + cmd.length + 1
        cursorOffset = 1 + command.length + 1
      }
      break
  }

  // Wrap with $ if not in math mode
  const finalTemplate = inMath ? template : `$${template}$`
  const baseOffset = inMath ? 0 : 1
  // For case 0, cursor should be at the very end (after trailing $ if not in math mode)
  const trailingOffset = argCount === 0 && !inMath ? 1 : 0
  const finalCursorOffset = baseOffset + cursorOffset + trailingOffset

  // Return the new text and cursor position...
  return {
    newText: textBefore + finalTemplate + fullText.substring(end),
    cursorPosition: start + finalCursorOffset,
  }
}

/**
 * Inserts a markdown link.
 *
 * - If text selected: wraps as [selected text](|) with cursor in parens
 * - If no selection: inserts [text](|) with 'text' selected
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position.
 */
export function insertLink(context: EditContext): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // If something is selected
  if (selectedText) {
    // Wrap selection as link text, cursor goes inside parentheses for URL
    const markdown = `[${selectedText}]()`
    return {
      newText: fullText.substring(0, start) + markdown + fullText.substring(end),
      cursorPosition: start + selectedText.length + 3,
    }
  } else {
    // No selection: we'll insert a placeholder and select it
    const placeholder = 'text'
    const markdown = `[${placeholder}]()`

    // Return the new text and cursor position, with selected placeholder
    return {
      newText: fullText.substring(0, start) + markdown + fullText.substring(end),
      cursorPosition: start + 1,
      selectionEnd: start + 1 + placeholder.length,
    }
  }
}

/**
 * Creates a markdown link from selected text and a URL.
 * Used when pasting a URL over selected text.
 *
 * @param context - The current editor context.
 * @param url - The URL to create the link from.
 *
 * @returns The new text and cursor position.
 */
export function createMarkdownLink(context: EditContext, url: string): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Get the markdown link
  const markdown = `[${selectedText}](${url.trim()})`

  // Return the new text and cursor position after the link
  return {
    newText: fullText.substring(0, start) + markdown + fullText.substring(end),
    cursorPosition: start + markdown.length,
  }
}

/**
 * Inserts a fenced code block (```code```).
 * Always inserts block syntax, never inline.
 * If nothing is selected, inserts a placeholder that can be immediately replaced.
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position.
 */
export function insertBlockCode(context: EditContext): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Get the index of where the line starts
  const lineStart = fullText.lastIndexOf('\n', start - 1) + 1

  // Check if the cursor is at the start/end of the line
  const isAtLineStart = start === lineStart
  const isAtEnd = end === fullText.length

  // Build the opening delimiter (with leading newline if needed)
  let before = ''
  if (!isAtLineStart && start > 0) before += '\n'
  before += '```\n'

  // Build the closing delimiter (with trailing newline if not at end)
  let after = '\n```'
  if (!isAtEnd) after += '\n'

  // Use placeholder when nothing is selected
  const content = selectedText || 'code'

  // Build the new text
  const newText = fullText.substring(0, start) + before + content + after + fullText.substring(end)

  // Calculate the cursor position
  const cursorPosition = start + before.length

  // Return the new text, cursor position,
  // and the selection used only if nothing was originally selected
  return {
    newText,
    cursorPosition: cursorPosition,
    selectionEnd: selectedText ? undefined : cursorPosition + content.length,
  }
}

/**
 * Inserts an H3 heading at the current line.
 * If the line is empty, inserts '### Nadpis' with 'Nadpis' selected.
 * If the line has content (or multiple lines selected), prefixes each line with '### '.
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position.
 */
export function insertHeading(context: EditContext): EditResult {
  // Get context data
  const { start, end, fullText } = context

  // Calculate the effective range of lines involved
  // When end is at the start of a line (and not same as start), we exclude that line
  const effectiveEnd = end > start && fullText[end - 1] === '\n' ? end - 1 : end

  // Find start of the first line
  const startLineStart = fullText.lastIndexOf('\n', start - 1) + 1

  // Find end of the last line
  const nextNewline = fullText.indexOf('\n', effectiveEnd)
  const endLineEnd = nextNewline === -1 ? fullText.length : nextNewline

  // Get the content of the affected lines
  const content = fullText.substring(startLineStart, endLineEnd)

  // Check if we are acting on a single empty line (or whitespace only)
  if (!content.includes('\n') && content.trim().length === 0) {
    // Determine prefix and placeholder
    const prefix = '### '
    const placeholder = 'Nadpis'

    // Replace the empty line with prefix + placeholder
    const newText =
      fullText.substring(0, startLineStart) + prefix + placeholder + fullText.substring(endLineEnd)
    const cursorPosition = startLineStart + prefix.length

    // Return the new text with placeholder selected for immediate replacement
    return {
      newText,
      cursorPosition,
      selectionEnd: cursorPosition + placeholder.length,
    }
  }

  // Otherwise, use generic line prefixing (handles single non-empty line and multi-line)
  return insertLinePrefix(context, '### ')
}

/**
 * Handles the Enter key for list and blockquote continuation.
 *
 * - If on a list/quote item with content -> continues (next bullet, incremented number, or quote).
 * - If on an empty list/quote item -> removes the marker (exits mode).
 * - Otherwise -> returns null (let default behavior happen).
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position, or null if no action was taken.
 */
export function handleListContinuation(context: EditContext): EditResult | null {
  // Get context data
  const { start, end, fullText } = context

  // Find start of current line
  const lineStart = fullText.lastIndexOf('\n', start - 1) + 1
  const lineContent = fullText.substring(lineStart, start)

  // Check for an empty blockquote line / unordered list / ordered list line
  const blockquoteMatch = lineContent.match(/^(\s*)(>)\s*$/)
  const unorderedListMatch = lineContent.match(/^(\s*)([-*])\s*$/)
  const orderedListMatch = lineContent.match(/^(\s*)(\d+\.|\d+\))\s*$/)

  // If we hit 'Enter' on a line with just a list marker, we'll remove the marker and
  // insert a new line (effectively "exiting" the list/quote mode)
  if (blockquoteMatch || unorderedListMatch || orderedListMatch) {
    return {
      newText: fullText.substring(0, lineStart) + '\n' + fullText.substring(start),
      cursorPosition: lineStart + 1,
    }
  }

  // Check for a non-empty list item or blockquote
  const blockquotePrefixMatch = lineContent.match(/^(\s*)(>)\s+/)
  const unorderedPrefixMatch = lineContent.match(/^(\s*)([-*])\s+/)
  const orderedPrefixMatch = lineContent.match(/^(\s*)(\d+)\.\s+/)

  // We will handle all matches at once
  const match = blockquotePrefixMatch || unorderedPrefixMatch || orderedPrefixMatch

  // No match means no edit
  if (!match) return null

  // If we have a match, we will continue the list
  let prefix = match[0]

  // If we have an ordered list, we will increment the number
  if (orderedPrefixMatch) {
    // Parse out the indent and number
    const indent = orderedPrefixMatch[1]
    const number = parseInt(orderedPrefixMatch[2], 10)

    // Reset the prefix to include the higher number
    prefix = `${indent}${number + 1}. `
  }

  // Return the new text and cursor position one index after the new item
  return {
    newText: fullText.substring(0, start) + '\n' + prefix + fullText.substring(end),
    cursorPosition: start + 1 + prefix.length,
  }
}

/**
 * Inserts a spoiler block with the directive format :::spoiler[Label]\ncontent\n:::
 * If no text is selected, inserts a placeholder that can be immediately replaced.
 *
 * @param context - The current editor context.
 *
 * @returns The new text and cursor position.
 */
export function insertSpoiler(context: EditContext): EditResult {
  // Get context data
  const { start, end, selectedText, fullText } = context

  // Build the content
  const content = selectedText || 'skrytý obsah'

  // Build the new text using directive syntax
  const spoilerBlock = `:::spoiler[Skrytý text]\n${content}\n:::`
  const newText = fullText.substring(0, start) + spoilerBlock + fullText.substring(end)

  // Position cursor at start of content, with selection to end of content
  // ":::spoiler[Skrytý text]\n" = 24 characters
  const contentStart = start + 24

  // Return the new text and cursor position, with content selected only if selected originally
  return {
    newText,
    cursorPosition: contentStart,
    selectionEnd: selectedText ? undefined : contentStart + content.length,
  }
}

/**
 * Determines if the cursor position is inside a math context.
 * Supports both inline ($...$) and display ($$...$$) math modes.
 * Correctly ignores escaped dollar signs (\$).
 *
 * @param textBefore - The text content before the cursor position
 *
 * @returns true if cursor is inside math mode, false otherwise
 */
export function isInMathMode(textBefore: string): boolean {
  // First, remove escaped dollar signs (\$) - they don't count as math delimiters
  const withoutEscaped = textBefore.replace(/\\\$/g, '')

  // Count $$ pairs (display math) - odd count means we're inside $$...$$
  const displayMathMatches = withoutEscaped.match(/\$\$/g) || []
  const isInDisplayMath = displayMathMatches.length % 2 === 1

  // For inline math, remove all $$ first, then count remaining $
  // Odd count means we're inside $...$
  const withoutDisplayMath = withoutEscaped.replace(/\$\$/g, '')
  const inlineDollarCount = (withoutDisplayMath.match(/\$/g) || []).length
  const isInInlineMath = inlineDollarCount % 2 === 1

  // Return true if we're inside either display or inline math
  return isInDisplayMath || isInInlineMath
}

/** Applies **bold** formatting to the selection or inserts a placeholder. */
export const applyBold = (context: EditContext) => wrapSelection(context, '**', '**', 'text')

/** Applies *italic* formatting to the selection or inserts a placeholder. */
export const applyItalic = (context: EditContext) => wrapSelection(context, '*', '*', 'text')

/** Applies `inline code` formatting to the selection or inserts a placeholder. */
export const applyInlineCode = (context: EditContext) => wrapSelection(context, '`', '`', 'code')

/** Applies $inline math$ formatting to the selection or inserts a placeholder. */
export const applyInlineMath = (context: EditContext) => wrapSelection(context, '$', '$', 'x^2')

/** Applies blockquote (> ) formatting to the current line or selection. */
export const applyQuote = (context: EditContext) => insertLinePrefix(context, '> ')

/** Applies bullet list (- ) formatting to the current line or selection. */
export const applyBulletList = (context: EditContext) => insertLinePrefix(context, '- ')

/** Applies numbered list (1. ) formatting to the current line or selection. */
export const applyNumberedList = (context: EditContext) => insertLinePrefix(context, '1. ')
