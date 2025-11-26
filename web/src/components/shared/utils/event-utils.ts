/**
 * Checks if a mouse event indicates an exclusive selection attempt.
 * Exclusive selection is triggered by Ctrl/Cmd+Click (desktop).
 * Long-press detection on mobile is handled separately using Mantine's useLongPress hook.
 *
 * @param event - The React mouse event to check
 * @returns True if the event indicates exclusive selection should occur
 */
export function isExclusiveSelection(event: React.MouseEvent | React.TouchEvent): boolean {
  // Check React synthetic event properties first (handles Firefox compatibility)
  if ('ctrlKey' in event || 'metaKey' in event) {
    const mouseEvent = event as React.MouseEvent
    return mouseEvent.ctrlKey || mouseEvent.metaKey
  }

  // Fallback: check native event for modifier keys
  const nativeEvent = (event as React.MouseEvent | React.TouchEvent).nativeEvent

  // Prefer PointerEvent if available (modern standard)
  if (nativeEvent instanceof PointerEvent) {
    return nativeEvent.ctrlKey || nativeEvent.metaKey
  }

  // Fallback to MouseEvent for older browsers
  if (nativeEvent instanceof MouseEvent) {
    return nativeEvent.ctrlKey || nativeEvent.metaKey
  }

  // Not a mouse event?
  return false
}
