/**
 * Where the latest press on the page landed while it was a pointer's; null once a key has been pressed since, and
 * before anything has been pressed at all.
 */
let pointerPressTarget: EventTarget | null = null

/**
 * Notes a press on the page.
 *
 * @param target - Where a pointer's press landed; null for a key's.
 */
export function notePress(target: EventTarget | null): void {
  // Kept as the latest press
  pointerPressTarget = target
}

/**
 * Where the latest press on the page landed, while that press was a pointer's. Read it outside render, since a press
 * changes it without causing one.
 *
 * @returns The element pressed, or null once a key was pressed after it or before anything was pressed at all.
 */
export function latestPointerPressTarget(): EventTarget | null {
  // The press as last noted
  return pointerPressTarget
}

/**
 * Puts focus on an element on the reader's behalf, ringed only when their latest press was a key: after a click it
 * comes without a ring, after Escape or a shortcut with one. A browser left to decide reads a focus moved from code
 * its own way, Safari ringing one even after a click. Passed as a ref, it focuses its element as the element
 * appears, as `autoFocus` does.
 *
 * @param target - The element; null for none, which leaves focus where it is.
 * @param options - How the focus lands, the ring aside.
 */
export function focusForReader(
  target: HTMLElement | null,
  options?: Omit<FocusOptions, 'focusVisible'>
): void {
  // Focused, ringed as the latest press decides
  target?.focus({ ...options, focusVisible: pointerPressTarget === null })
}
