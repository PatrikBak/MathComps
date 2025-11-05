/**
 * Checks if a mouse or touch event indicates an exclusive selection attempt.
 * Exclusive selection is triggered by Ctrl/Cmd+Click (desktop) or long press (touch).
 * When exclusive selection is triggered, only the clicked item should be selected
 * (all other selections are cleared).
 *
 * This is useful for multi-select components where users might want to quickly
 * select only one item instead of toggling it in a list.
 *
 * @param event - The React mouse or touch event to check
 * @returns True if the event indicates exclusive selection should occur
 *
 * @example
 * ```tsx
 * const handleClick = (event: React.MouseEvent) => {
 *   if (isExclusiveSelection(event)) {
 *     onChange([optionId])
 *     return
 *   }
 *   // Normal selection logic
 * }
 * ```
 */
export function isExclusiveSelection(event: React.MouseEvent | React.TouchEvent): boolean {
  // For React.MouseEvent, check the React event properties first
  // This handles Firefox compatibility where nativeEvent might not have modifier keys reliably
  if ('ctrlKey' in event || 'metaKey' in event) {
    const mouseEvent = event as React.MouseEvent
    return mouseEvent.ctrlKey || mouseEvent.metaKey
  }

  // Fallback: check native event for modifier keys
  // We need to access nativeEvent before type narrowing to avoid TypeScript errors
  const nativeEvent = (event as React.MouseEvent | React.TouchEvent).nativeEvent

  // Prefer PointerEvent if available (modern standard, avoids Firefox deprecation warnings)
  if (nativeEvent instanceof PointerEvent) {
    return nativeEvent.ctrlKey || nativeEvent.metaKey
  }

  // Fallback to MouseEvent for older browsers
  if (nativeEvent instanceof MouseEvent) {
    return nativeEvent.ctrlKey || nativeEvent.metaKey
  }

  // Touch events: check for long press (single touch point)
  // Note: Actual long press detection should be handled by the component
  // using touchstart/touchend timing, but we check for single touch here
  if (typeof TouchEvent !== 'undefined' && nativeEvent instanceof TouchEvent) {
    return nativeEvent.touches.length === 1
  }

  return false
}
