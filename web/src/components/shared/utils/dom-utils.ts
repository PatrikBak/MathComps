/**
 * Forces the browser to scroll the textarea so the caret is visible.
 *
 * This works by blurring and immediately re-focusing the element,
 * which triggers the browser's native scroll-to-caret behavior.
 *
 * Use this after programmatically changing the cursor position
 * (e.g., after inserting text or restoring from history) to ensure
 * the user can see where they're typing.
 *
 * @param textarea - The textarea element to affect.
 */
export function ensureVisibleCaret(textarea: HTMLTextAreaElement): void {
  textarea.blur()
  textarea.focus()
}
