import { useCallback } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'

import { processKeyboardShortcut } from '../utils/keyboard-utils'
import { type UseEditorTextResult } from './use-editor-text'

/**
 * Options for the {@link useEditorKeyboard} hook.
 */
type UseEditorKeyboardOptions = {
  /** The editor's text and the edits it takes. */
  text: UseEditorTextResult
  /** The send the editor runs, where it sends at all. */
  onSend: (() => void) | undefined
  /** The cancel the editor runs, where it cancels at all. */
  onCancel: (() => void) | undefined
}

/**
 * Return type for the {@link useEditorKeyboard} hook.
 */
export type UseEditorKeyboardResult = {
  /** Answers a key pressed in the text. */
  handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
}

/**
 * The keys an editor answers: the shortcuts {@link processKeyboardShortcut} knows, ⌘/Ctrl+Enter to send
 * and Escape to cancel.
 *
 * @param options - The text the keys edit, and the send and cancel they run.
 *
 * @returns The textarea's key handler.
 */
export function useEditorKeyboard({
  text,
  onSend,
  onCancel,
}: UseEditorKeyboardOptions): UseEditorKeyboardResult {
  // The pieces of the text the keys reach
  const { isSendable, createEditContext, applyTransform, undo, redo } = text

  /**
   * Handles a key pressed in the text. The magic happens in {@link processKeyboardShortcut}.
   *
   * @param event - The key pressed.
   */
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      // The selection and the text it sits in, where a textarea is on screen to hold them
      const context = createEditContext()
      if (!context) return

      // What the key does to the text
      const action = processKeyboardShortcut(event, context)

      // Each kind of action goes its own way
      switch (action.type) {
        // A formatting shortcut, or a list carried on to the next line
        case 'handled':
          // The key does nothing of the browser's own
          event.preventDefault()

          // The shortcut's edit lands in the text
          applyTransform(() => action.result)

          // Nothing more for this key
          return

        // Undo
        case 'undo': {
          // The browser's own undo stays out of it
          event.preventDefault()

          // The editor's own history steps back instead
          undo()

          // Nothing more for this key
          return
        }

        // Redo
        case 'redo': {
          // The browser's own redo stays out of it
          event.preventDefault()

          // The editor's own history steps forward instead
          redo()

          // Nothing more for this key
          return
        }

        // Not a shortcut, which leaves the key to the send and cancel below, or to the textarea
        case 'passthrough':
          break

        // Every kind of action is handled above
        default:
          assertNever(action)
      }

      // ⌘/Ctrl+Enter sends, where there is a send and no other handler took the key. Enter alone writes a
      // new line
      if (
        !event.defaultPrevented &&
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey) &&
        onSend
      ) {
        // Sent only when a send may go
        if (isSendable) {
          // The key writes no line of its own
          event.preventDefault()

          // The draft goes
          onSend()
        }
      }

      // Escape cancels, where there is a cancel and no other handler took the key
      if (!event.defaultPrevented && event.key === 'Escape' && onCancel) {
        // Taken here, which keeps a dialog the editor sits in from closing on it too
        event.preventDefault()

        // The cancel runs
        onCancel()
      }
    },
    [isSendable, applyTransform, undo, redo, createEditContext, onSend, onCancel]
  )

  // The key handler for the text
  return { handleKeyDown }
}
