import { type MouseEvent, useRef } from 'react'
import { LongPressEventType, type LongPressPointerHandlers, useLongPress } from 'use-long-press'

/**
 * The handlers an element spreads to answer a long press.
 */
type UseSmartLongPressResult = LongPressPointerHandlers & {
  /** Starts every press with nothing answered yet. */
  onPointerDownCapture: () => void
  /** Swallows the click the release of a long press sends. */
  onClickCapture: (event: MouseEvent) => void
}

/**
 * A "smart" long press hook that distinguishes between a deliberate long press
 * and a scroll gesture. Internally uses the `use-long-press` library.
 *
 * Releasing a long press can still send the element a click, which would act on it a second time after the
 * press already has, so that click is swallowed before anything inside the element hears it.
 *
 * @param callback - Function to call when long press completes
 *
 * @returns The event handlers to spread onto your element
 */
export function useSmartLongPress(callback: () => void): UseSmartLongPressResult {
  // Whether the press under way has already been answered as a long one
  const isAnsweredRef = useRef(false)

  // The library's own handlers
  const handlers = useLongPress(
    () => {
      // The click the release may send is this press's own
      isAnsweredRef.current = true

      // What the long press is for
      callback()
    },
    {
      threshold: 500,
      cancelOnMovement: 10,
      detect: LongPressEventType.Pointer,
      filterEvents: (event) => {
        // Only trigger on primary button (left click or touch contact)
        if ('button' in event && event.button !== 0) {
          return false
        }
        return true
      },
    }
  )()

  // A function which starts a press with nothing answered, since a release that sent no click leaves one standing
  const onPointerDownCapture = () => {
    // Nothing to swallow until this press turns out long
    isAnsweredRef.current = false
  }

  // A function which swallows the click a long press's release sends, before anything inside the element hears it
  const onClickCapture = (event: MouseEvent) => {
    // Only the click closing a long press goes, and a keyboard's click, counting no presses, never closes one
    if (!isAnsweredRef.current || event.detail === 0) return

    // Spent once swallowed
    isAnsweredRef.current = false

    // The element's own click handlers never hear it, and nothing it would toggle moves
    event.preventDefault()
    event.stopPropagation()
  }

  // The library's handlers, and the two that keep a long press from also counting as a click
  return { ...handlers, onPointerDownCapture, onClickCapture }
}
