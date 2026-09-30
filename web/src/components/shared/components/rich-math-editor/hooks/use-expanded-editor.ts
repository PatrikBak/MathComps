import type { KeyboardEventHandler } from 'react'
import { useState } from 'react'

import { useIsMobile } from '@/hooks/use-breakpoint'

import { useEditorKeyboard } from './use-editor-keyboard'
import { type UseEditorTextResult } from './use-editor-text'

/**
 * Options for the {@link useExpandedEditor} hook.
 */
type UseExpandedEditorOptions = {
  /** The text the expanded view shows and its keys edit. */
  text: UseEditorTextResult
  /** Whether a phone gets the expanded view alone, with no inline editor under it. */
  autoExpandOnMobile: boolean
  /** The surface's own send, where it has one. */
  onSend: (() => void) | undefined
  /** The surface's own cancel, where it has one. */
  onCancel: (() => void) | undefined
}

/**
 * Return type for the {@link useExpandedEditor} hook.
 */
export type UseExpandedEditorResult = {
  /** Whether the expanded view is open. */
  isOpen: boolean
  /** Whether the expanded view is the whole editor, with no inline one standing behind it. */
  isOnlyEditor: boolean
  /** Opens the expanded view. */
  open: () => void
  /** Closes the expanded view, which puts the editor away where nothing stands behind it. */
  close: () => void
  /**
   * Answers a key pressed in the expanded text as {@link useEditorKeyboard} does, with
   * {@link UseExpandedEditorResult.send} as its send and {@link UseExpandedEditorResult.close} as its
   * cancel.
   */
  handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  /**
   * Sends the draft, where the surface sends at all. With an inline editor behind it the view closes
   * first. As the whole editor it stays up, the draft still in it should the send fail; putting it away
   * after a send is the surface's to do.
   */
  send: (() => void) | undefined
  /** Closes the expanded view and cancels the editor, where the surface cancels at all. */
  cancel: (() => void) | undefined
}

/**
 * The expanded view of an editor: whether it is open, whether it stands in for the inline editor
 * altogether, and how its keys, send and cancel leave it.
 *
 * @param options - The text, how the editor expands, and its surface's send and cancel.
 *
 * @returns The expanded view's state and the ways in and out of it.
 */
export function useExpandedEditor({
  text,
  autoExpandOnMobile,
  onSend,
  onCancel,
}: UseExpandedEditorOptions): UseExpandedEditorResult {
  // Whether the viewport is phone-width
  const isMobile = useIsMobile()

  // Whether the expanded view is the whole editor
  const isOnlyEditor = autoExpandOnMobile && isMobile

  // Whether the expanded view is open
  const [isOpen, setIsOpen] = useState(isOnlyEditor)

  // The last reading of whether the expanded view is the whole editor, to catch the moment it becomes one
  const [wasOnlyEditor, setWasOnlyEditor] = useState(isOnlyEditor)

  // The whole-editor reading changes, as the phone check settles after mount
  if (isOnlyEditor !== wasOnlyEditor) {
    // The reading moves on to this one
    setWasOnlyEditor(isOnlyEditor)

    // Open once there is nothing else to write in
    if (isOnlyEditor) {
      setIsOpen(true)
    }
  }

  /**
   * A function which opens the expanded view.
   */
  const open = () => setIsOpen(true)

  /**
   * A function which closes the expanded view.
   */
  const close = () => {
    // The expanded view closes
    setIsOpen(false)

    // With no editor underneath, the whole thing is away
    if (isOnlyEditor) {
      onCancel?.()
    }
  }

  /**
   * A function which sends from the expanded view, where the surface sends at all.
   */
  const send = onSend
    ? () => {
        // Down to the editor underneath, where there is one
        if (!isOnlyEditor) {
          setIsOpen(false)
        }

        // And the draft on its way
        onSend()
      }
    : undefined

  /**
   * A function which closes the expanded view and cancels the editor, where the surface cancels at all.
   */
  const cancel = onCancel
    ? () => {
        // Out of the expanded view
        close()

        // Closing only stepped back to the editor behind, so the cancel still has to run
        if (!isOnlyEditor) {
          onCancel()
        }
      }
    : undefined

  // The keys of the expanded text, with this view's own send and close
  const { handleKeyDown } = useEditorKeyboard({ text, onSend: send, onCancel: close })

  // The expanded view's state and the ways in and out of it
  return { isOpen, isOnlyEditor, open, close, handleKeyDown, send, cancel }
}
