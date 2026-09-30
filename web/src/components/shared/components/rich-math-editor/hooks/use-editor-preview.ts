import type { MouseEventHandler, RefObject } from 'react'
import { useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Options for the {@link useEditorPreview} hook.
 */
type UseEditorPreviewOptions = {
  /** Whether the text holds anything worth rendering. */
  hasContent: boolean
  /** Whether the editor offers a preview in place of its text. */
  canPreview: boolean
  /** The textarea the preview stands in for. */
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

/**
 * Return type for the {@link useEditorPreview} hook.
 */
export type UseEditorPreviewResult = {
  /** Whether the rendered text stands in place of the textarea. */
  isShown: boolean
  /** Whether the preview can be turned on. */
  isEnabled: boolean
  /**
   * Swaps between the text and its preview, as the click handler of the control that does it. The
   * cursor goes to that control on the way in and back to the text on the way out.
   */
  toggle: MouseEventHandler<HTMLButtonElement>
}

/**
 * The in-place preview of an editor's text: whether it is on, and the swap between the two.
 *
 * @param options - Whether there is a preview to show, and the textarea it covers.
 *
 * @returns The preview's state and its toggle.
 */
export function useEditorPreview({
  hasContent,
  canPreview,
  textareaRef,
}: UseEditorPreviewOptions): UseEditorPreviewResult {
  // Whether the reader has the preview on
  const [isShown, setIsShown] = useState(false)

  // A preview needs something to render, and an editor offering one
  const isEnabled = canPreview && hasContent

  // A preview that cannot be on puts the text back
  if (isShown && !isEnabled) {
    setIsShown(false)
  }

  /**
   * A function which swaps between the text and its preview.
   *
   * @param event - The click on the control that swaps them.
   */
  const toggle: MouseEventHandler<HTMLButtonElement> = (event) => {
    // Into the preview
    if (!isShown) {
      // The cursor leaves the text the preview covers, which Safari would otherwise go on typing into,
      // for the control itself. There it is still inside the editor, so the keys its surface answers
      // go on reaching it
      event.currentTarget.focus()

      // And the rendered text goes up over the textarea
      setIsShown(true)

      // Nothing more on the way in
      return
    }

    // Back to the text, committed at once so the textarea is on screen by the time it takes the cursor
    flushSync(() => setIsShown(false))

    // And the cursor back into the textarea
    textareaRef.current?.focus()
  }

  // Whether the preview is up, whether it can be, and the swap between the two
  return { isShown, isEnabled, toggle }
}
