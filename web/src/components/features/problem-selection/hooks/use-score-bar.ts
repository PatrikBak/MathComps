'use client'

import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'

import { SCORE_KEYS, scoreAt } from '../model/rating-scale'

/**
 * How a score bar draws the score it shows: the score given, the step a press or a drag is on, or the step a
 * hovering mouse would give.
 */
export type ScoreBarLook = 'standing' | 'pressed' | 'hovered'

/**
 * A step a pointer over the bar shows in place of the score given.
 */
type ScoreBarPreview = {
  /** The step shown. */
  score: number
  /** Whether a press shows it, or a mouse hovering over it. */
  look: 'pressed' | 'hovered'
}

/**
 * Options for {@link useScoreBar}.
 */
type UseScoreBarOptions = {
  /** The score given; null for none. */
  score: number | null
  /** Sets the score; null takes it back. */
  onScore: (score: number | null) => void
  /** Sets the score from a key, which may come again at once while the key is held; null takes it back. */
  onKeyScore: (score: number | null) => void
}

/**
 * The handlers a score bar takes, which drive its score by the pointer and by keys.
 */
type ScoreBarHandlers = {
  /** Puts the step under a press on the bar at once, and follows the pointer until it lets go. */
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  /** Follows a press as it drags, or previews the step a hovering mouse would give. */
  onPointerMove: (event: PointerEvent<HTMLElement>) => void
  /** Sets the score to the step a press lets go on. */
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  /** Drops a press the browser called off, setting nothing. */
  onPointerCancel: () => void
  /** Drops a hovering mouse's preview once it leaves the bar. */
  onPointerLeave: () => void
  /** Moves the score, or takes it back, for each key {@link SCORE_KEYS} answers. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/**
 * Return type for {@link useScoreBar}.
 */
type UseScoreBarResult = {
  /** The score the bar shows; null for none. */
  shownScore: number | null
  /** How the bar draws it. */
  look: ScoreBarLook
  /** Sets the score, unless it is already the score given. */
  setScore: (score: number | null) => void
  /** The bar's handlers. */
  handlers: ScoreBarHandlers
}

/**
 * Reads how far along an element a pointer is.
 *
 * @param event - The pointer's event on the element.
 *
 * @returns The distance from the element's left edge, as a share of its width.
 */
function fractionAlong(event: PointerEvent<HTMLElement>): number {
  // The element's box
  const box = event.currentTarget.getBoundingClientRect()

  // The pointer's distance from its left edge, as a share of its width
  return (event.clientX - box.left) / box.width
}

/**
 * A slider over a score, driven by a pointer in half steps and by keys in tenths. A press shows the step under it at
 * once and a drag carries it along, and a release or a key sets the score. A hovering mouse previews the step a press
 * would give.
 *
 * @param options - The score given and the ways to set it.
 *
 * @returns The score to show, how to draw it, the way to set it, and the bar's handlers.
 */
export function useScoreBar({ score, onScore, onKeyScore }: UseScoreBarOptions): UseScoreBarResult {
  // The step a pointer shows in place of the score, none while no pointer does
  const [preview, setPreview] = useState<ScoreBarPreview | null>(null)

  // Whether a press on the bar is going on
  const isPressed = useRef(false)

  // A function which sets the score through the callback given, unless it is already the score given
  const setIfMoved = (next: number | null, set: (score: number | null) => void) => {
    // The score already given, nothing to set
    if (next === score) return

    // The score, set
    set(next)
  }

  // A function which sets the score, unless it is already the score given
  const setScore = (next: number | null) => setIfMoved(next, onScore)

  // A function which starts a press on the step under it
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // A press by the primary button alone, never one opening a context menu
    if (event.button !== 0 || event.ctrlKey) return

    // The pointer followed until it lets go, off the bar's edges too
    event.currentTarget.setPointerCapture(event.pointerId)

    // The press going on
    isPressed.current = true

    // The step pressed, shown at once
    setPreview({ score: scoreAt(fractionAlong(event)), look: 'pressed' })
  }

  // A function which follows a press as it drags, or previews a hovering mouse's step
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    // The step under the pointer
    const step = scoreAt(fractionAlong(event))

    // A press going on carries the step along
    if (isPressed.current) {
      // The step under it shown
      setPreview({ score: step, look: 'pressed' })

      // Nothing for a hover to preview
      return
    }

    // A finger shows a step only by pressing it
    if (event.pointerType !== 'mouse') return

    // A mouse previews the step a press would give, nothing over the score given
    setPreview(step === score ? null : { score: step, look: 'hovered' })
  }

  // A function which ends a press, setting the step it lets go on
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    // No press to end
    if (!isPressed.current) return

    // The press over
    isPressed.current = false

    // And its step no longer shown over the score
    setPreview(null)

    // The step the pointer lets go on, set
    setScore(scoreAt(fractionAlong(event)))
  }

  // A function which drops a press the browser called off
  const onPointerCancel = () => {
    // The press over
    isPressed.current = false

    // And nothing shown over the score
    setPreview(null)
  }

  // A function which drops a hovering mouse's preview, leaving a press's in place
  const onPointerLeave = () => {
    // A press keeps its step until it lets go
    if (isPressed.current) return

    // The preview gone
    setPreview(null)
  }

  // A function which moves the score for the keys the bar answers, leaving every other key to the menu
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // What the key does to the score, if the bar answers it
    const key = SCORE_KEYS[event.key]

    // A key the bar leaves alone, and every key held with a modifier, which is the browser's
    if (key === undefined || event.altKey || event.ctrlKey || event.metaKey) return

    // The key the bar's, not the menu's
    event.preventDefault()

    // A mouse's preview dropped, so the bar shows the score the key sets
    setPreview(null)

    // The score the key moves to, set as a key's score
    setIfMoved(key(score, event.shiftKey), onKeyScore)
  }

  // The step a pointer shows, else the score given
  const shownScore = preview === null ? score : preview.score

  // Drawn as the pointer shows it, else as standing
  const look: ScoreBarLook = preview === null ? 'standing' : preview.look

  // The score shown, how to draw it, the way to set it, and the bar's handlers
  return {
    shownScore,
    look,
    setScore,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onKeyDown,
    },
  }
}
