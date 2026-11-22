/**
 * Whether an event asks for the option it lands on and nothing else, which is what holding the
 * modifier through a click or a keypress means. A touchscreen has no modifier to hold, so a long
 * press stands in for it as {@link EXCLUSIVE_LONG_PRESS}.
 *
 * @param event - The click, tap or keypress to read, as React or the browser hands it over.
 * @returns True when the modifier was down.
 */
export function isExclusiveSelection(
  event: React.MouseEvent | React.TouchEvent | React.KeyboardEvent | MouseEvent
): boolean {
  // Ctrl on Windows and Linux, Cmd on macOS
  return event.ctrlKey || event.metaKey
}

/**
 * The click a long press stands in for on a touchscreen: one with the modifier held. It carries only the keys
 * {@link isExclusiveSelection} reads.
 */
export const EXCLUSIVE_LONG_PRESS = { ctrlKey: true, metaKey: false } as React.MouseEvent

/**
 * Whether a click on a link means follow it here, with no modifier or other button asking the browser for
 * something else.
 *
 * @param event - The click.
 * @returns True for a primary-button click with no modifier held.
 */
export function isPlainClick(event: React.MouseEvent): boolean {
  // The primary button, and no modifier key down
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
