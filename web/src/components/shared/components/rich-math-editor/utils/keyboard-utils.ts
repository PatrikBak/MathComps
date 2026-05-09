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
 * A formatting shortcut was applied (bold, italic, code, etc.).
 * The result contains the new text and cursor position.
 */
type HandledAction = {
  /** Discriminator for formatting actions */
  type: 'handled'
  /** The edit result with new text and cursor position */
  result: EditResult
}

/**
 * Ctrl+Z was pressed, trigger undo from the history stack.
 */
type UndoAction = {
  /** Discriminator for undo */
  type: 'undo'
}

/**
 * Ctrl+Y or Ctrl+Shift+Z was pressed, trigger redo from the history stack.
 */
type RedoAction = {
  /** Discriminator for redo */
  type: 'redo'
}

/**
 * No keyboard shortcut matched, let the browser handle the event normally.
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
 * Processes keyboard shortcuts for text formatting.
 *
 * @param event - The keyboard event
 * @param context - The current edit context (cursor position, selection, text)
 * @returns The action to take based on the keyboard input
 */
export function processKeyboardShortcut(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  context: EditContext
): KeyboardAction {
  // Extract keyboard state. metaKey covers Cmd on Mac so that Mac users get the
  // platform-native modifier alongside Ctrl on Windows/Linux.
  const { key, ctrlKey, metaKey, shiftKey, altKey } = event

  // Handle Enter key for smart list continuation
  if (key === 'Enter' && !shiftKey && !ctrlKey && !altKey) {
    // A helper function will handle this and return whether
    // any list continuation was performed
    const result = handleListContinuation(context)

    // If yeah, return the new result of the text area
    if (result) {
      return { type: 'handled', result }
    }

    // Otherwise, let the browser handle the event normally
    return { type: 'passthrough' }
  }

  // Handle Ctrl/Cmd+Z (Undo)
  if ((ctrlKey || metaKey) && key === 'z' && !shiftKey) {
    return { type: 'undo' }
  }

  // Handle Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (Redo)
  if (((ctrlKey || metaKey) && key === 'y') || ((ctrlKey || metaKey) && shiftKey && key === 'z')) {
    return { type: 'redo' }
  }

  // Keyboard shortcuts for formatting (Ctrl/Cmd+Shift combos)
  if ((ctrlKey || metaKey) && shiftKey && !altKey) {
    switch (key.toLowerCase()) {
      case 'c': // Inline Code (Ctrl+Shift+C)
        return { type: 'handled', result: applyInlineCode(context) }
    }
  }

  // Keyboard shortcuts for formatting (Ctrl/Cmd only)
  if ((ctrlKey || metaKey) && !shiftKey && !altKey) {
    switch (key.toLowerCase()) {
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

  // If no keyboard shortcut was matched, let the browser handle the event normally
  return { type: 'passthrough' }
}

/**
 * Prevents default mouse down behavior to maintain focus on the textarea.
 * Use as `onMouseDown={preventFocusLoss}` on toolbar buttons, pickers, etc.
 *
 * @param event - The mouse event
 */
export function preventFocusLoss(event: React.MouseEvent) {
  event.preventDefault()
}
