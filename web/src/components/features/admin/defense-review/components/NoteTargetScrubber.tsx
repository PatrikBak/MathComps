'use client'

import { useTranslations } from 'next-intl'
import { type ChangeEvent, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { noteChoiceChipClass } from './NoteChoiceChip'

/**
 * One reply a note can stand against.
 */
type NoteTarget = {
  /** The reply itself. */
  id: string
  /** Where it sits in the conversation, 1-based. */
  sequence: number
}

/**
 * Props for whichever control the replies are chosen from.
 */
export type NoteTargetChoiceProps = {
  /** The replies to choose from, in the order they were said. */
  targets: NoteTarget[]
  /** Which one a new note stands against; null for the conversation as a whole. */
  turnId: string | null
  /** Points the note at another reply, or at the conversation as a whole. */
  onTurnIdChange: (turnId: string | null) => void
}

/** The rail the thumb runs along, drawn on the track each engine gives its own slider. */
const TRACK_CLASS = cn(
  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full',
  '[&::-webkit-slider-runnable-track]:bg-foreground/15',
  '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-foreground/15'
)

/** The thumb, sized and pulled back onto the middle of the rail. */
const THUMB_CLASS = cn(
  '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3.5',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
  '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full'
)

/** What it looks like once it stands for the reply the note is about: filled. */
const THUMB_PICKED_CLASS = cn(
  '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-brand',
  '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand'
)

/** And while it only marks where it was left, with the note standing against the conversation: hollow. */
const THUMB_WAITING_CLASS = cn(
  '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-brand/60',
  '[&::-webkit-slider-thumb]:bg-background',
  '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-brand/60',
  '[&::-moz-range-thumb]:bg-background'
)

/**
 * The keyboard's mark on it, drawn as an outline rather than as the house ring: a ring is a box-shadow, and a
 * box-shadow on a form control goes unpainted in WebKit and on the thumb pseudo-element in Firefox.
 */
const FOCUS_OUTLINE_CLASS = cn(
  'rounded-full',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'focus-visible:outline-focus'
)

/**
 * Which reply a note stands against, run through with a thumb.
 *
 * Sixty turns of chips come to a keypad of numbers standing over the composer; this holds one row however long
 * the conversation runs. The reply is still found by reading rather than by remembering a number, since the
 * transcript moves to whatever the thumb lands on.
 *
 * Both the chip and the track are real inputs rather than buttons, since the keys that step the review queue
 * skip typing only inside inputs.
 */
export function NoteTargetScrubber({ targets, turnId, onTurnIdChange }: NoteTargetChoiceProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // Where the thumb waits while the note stands against the conversation as a whole, starting at the last
  // reply, which is where the conversation was read to
  const [waitingIndex, setWaitingIndex] = useState(targets.length - 1)

  // Which reply the note stands against, and -1 while it stands against the conversation
  const pickedIndex = targets.findIndex((target) => target.id === turnId)

  // So where the thumb sits, falling back to where it was left when nothing is picked
  const thumbIndex = pickedIndex === -1 ? waitingIndex : pickedIndex

  // And the reply it is on
  const thumbTarget = targets[thumbIndex]

  /**
   * Points the note at whichever reply the thumb was moved to.
   *
   * @param event - The move.
   */
  function pickThumbTarget(event: ChangeEvent<HTMLInputElement>) {
    // Where it landed
    const index = Number(event.target.value)

    // Which is where it waits from here on
    setWaitingIndex(index)

    // And the reply standing there
    onTurnIdChange(targets[index]?.id ?? null)
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {/* The conversation as a whole, giving the note back to the waiting reply when it is dropped */}
      <label className={cn('shrink-0', noteChoiceChipClass(turnId === null))}>
        <input
          type="checkbox"
          className="sr-only"
          checked={turnId === null}
          onChange={() => onTurnIdChange(turnId === null ? (thumbTarget?.id ?? null) : null)}
          aria-label={t('onConversation')}
        />
        {t('wholeConversation')}
      </label>

      {/* The replies, a stop each */}
      <input
        type="range"
        min={0}
        max={targets.length - 1}
        step={1}
        value={thumbIndex}
        onChange={pickThumbTarget}
        aria-label={t('target')}
        aria-valuetext={
          thumbTarget === undefined ? undefined : t('reply', { sequence: thumbTarget.sequence })
        }
        className={cn(
          'h-4 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent',
          TRACK_CLASS,
          THUMB_CLASS,
          FOCUS_OUTLINE_CLASS,
          turnId === null ? THUMB_WAITING_CLASS : THUMB_PICKED_CLASS
        )}
      />

      {/* Which reply that is, in the width of the longest one so the track can't shift under a digit */}
      <span
        aria-hidden="true"
        className={cn(
          'shrink-0 text-right text-xs tabular-nums',
          turnId === null ? 'text-muted' : 'font-medium text-foreground'
        )}
        style={{ width: `${String(targets.at(-1)?.sequence ?? '').length}ch` }}
      >
        {thumbTarget?.sequence}
      </span>
    </div>
  )
}
