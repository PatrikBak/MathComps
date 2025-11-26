import { useLongPress } from 'use-long-press'

/**
 * A "smart" long press hook that distinguishes between a deliberate long press
 * and a scroll gesture. Internally uses the `use-long-press` library.
 *
 * @param callback - Function to call when long press completes
 *
 * @returns The event handlers to spread onto your element
 */
export function useSmartLongPress(callback: () => void) {
  return useLongPress(callback, {
    threshold: 500,
    cancelOnMovement: 10,
    filterEvents: (event) => {
      // Only trigger on primary button (left click or touch contact)
      if ('button' in event && event.button !== 0) {
        return false
      }
      return true
    },
  })()
}
