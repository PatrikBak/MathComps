import {
  applyBold,
  applyInlineCode,
  applyInlineMath,
  applyItalic,
  type EditContext,
  type EditResult,
  handleListContinuation,
  insertBlockCode,
  insertLink,
} from './transforms'

/**
 * A key answered with an edit: a formatting shortcut (bold, italic, code, etc.), or Enter carrying on
 * or ending a list or quote.
 */
type HandledAction = {
  /** Discriminator for a key answered with an edit */
  type: 'handled'
  /** The edit the key comes to */
  result: EditResult
}

/**
 * A key asking to undo the last edit: ⌘/Ctrl+Z.
 */
type UndoAction = {
  /** Discriminator for undo */
  type: 'undo'
}

/**
 * A key asking to redo the last undone edit: ⌘/Ctrl+Y or ⌘/Ctrl+Shift+Z.
 */
type RedoAction = {
  /** Discriminator for redo */
  type: 'redo'
}

/**
 * A key none of the shortcuts answer.
 */
type PassthroughAction = {
  /** Discriminator for passthrough */
  type: 'passthrough'
}

/**
 * Result of keyboard shortcut processing.
 */
type KeyboardAction = HandledAction | UndoAction | RedoAction | PassthroughAction

/**
 * Works out what a key pressed in the text comes to: a formatting edit, Enter carrying on or ending a
 * list or quote, undo, redo, or passing through.
 *
 * @param event - The keyboard event
 * @param context - The selection and the text it sits in
 *
 * @returns The action to take based on the keyboard input
 */
export function processKeyboardShortcut(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  context: EditContext
): KeyboardAction {
  // The key pressed and the modifiers held with it. Meta is ⌘ on a Mac, taken everywhere alongside Ctrl
  const { key, ctrlKey, metaKey, shiftKey, altKey } = event

  // A bare Enter, no modifier held, carries on or ends a list or quote
  if (key === 'Enter' && !shiftKey && !ctrlKey && !metaKey && !altKey) {
    // The edit Enter makes on a list or quote line, null on any other
    const result = handleListContinuation(context)

    // Enter on a list or quote line comes to that edit
    if (result) {
      return { type: 'handled', result }
    }

    // Otherwise Enter writes a new line of its own
    return { type: 'passthrough' }
  }

  // The letter pressed, whichever case it arrives in: Shift held with Ctrl names it in upper case, and so
  // does Caps Lock
  const letter = key.toLowerCase()

  // Handle Ctrl/Cmd+Z (Undo)
  if ((ctrlKey || metaKey) && letter === 'z' && !shiftKey) {
    return { type: 'undo' }
  }

  // Handle Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (Redo)
  if ((ctrlKey || metaKey) && (letter === 'y' || (shiftKey && letter === 'z'))) {
    return { type: 'redo' }
  }

  // Keyboard shortcuts for formatting (Ctrl/Cmd+Shift combos)
  if ((ctrlKey || metaKey) && shiftKey && !altKey) {
    switch (letter) {
      case 'c': // Inline Code (Ctrl/Cmd+Shift+C)
        return { type: 'handled', result: applyInlineCode(context) }
    }
  }

  // Keyboard shortcuts for formatting (Ctrl/Cmd only)
  if ((ctrlKey || metaKey) && !shiftKey && !altKey) {
    switch (letter) {
      case 'b': // Bold
        return { type: 'handled', result: applyBold(context) }
      case 'i': // Italic
        return { type: 'handled', result: applyItalic(context) }
      case 'k': // Link
        return { type: 'handled', result: insertLink(context) }
      case 'm': // Inline Math
        return { type: 'handled', result: applyInlineMath(context) }
      case 'e': // Code Block
        return { type: 'handled', result: insertBlockCode(context) }
    }
  }

  // Any other key passes through
  return { type: 'passthrough' }
}
