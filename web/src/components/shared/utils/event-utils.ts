/**
 * Whether an event asks for the option it lands on and nothing else, which is what holding the
 * modifier through a click or a keypress means. A touchscreen has no modifier to hold, so a long
 * press stands in for it and is recognised at the press.
 *
 * @param event - The click, tap or keypress to read.
 * @returns True when the modifier was down.
 */
export function isExclusiveSelection(
  event: React.MouseEvent | React.TouchEvent | React.KeyboardEvent
): boolean {
  // Ctrl on Windows and Linux, Cmd on macOS
  return event.ctrlKey || event.metaKey
}
