'use client'

import { useReducedMotion } from '@mantine/hooks'
import { Flag, Layers, Mail, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'
import { formatDurationMs } from '@/components/shared/utils/duration-utils'

import type { Turn } from '../model/defense-types'
import { TURN_LABEL_CLASS, TURN_STYLES } from './turn-styles'

/**
 * The controls a turn carries and their accessible labels. Shared by the transcript, which offers them on every
 * turn, and each turn, which renders the ones it was told to offer. Both controls act on the conversation,
 * so one flag governs them.
 */
export type TurnActionsAffordance = {
  /** Whether to offer the turn's own controls. */
  canAct: boolean
  /** The accessible label for the rewind control. */
  rewindLabel: string
  /** The accessible label for the report control. */
  reportLabel: string
  /** The accessible label a reply carries once it has been reported. */
  reportedLabel: string
}

/**
 * The control offering to pick the conversation up again from a turn, and what it is called. Held apart from the
 * affordance above because it answers a different question: not whether the conversation can still be acted on,
 * but whether whoever is reading it keeps their own place in it.
 */
export type TurnUnreadMark = {
  /** The accessible label for the control. */
  label: string
  /** Leaves the named turn unread, along with every turn after it. */
  onMark: (turnId: string) => void
}

/**
 * The way into the drafts a reply went through before it was sent. Only a reviewer gets this: a rejected draft
 * is the leak or the wrong claim a guard caught, so a turn only offers it where the reader is allowed to see
 * what the student was kept from.
 */
export type TurnDraftsMark = {
  /**
   * The accessible label for the control, given how many drafts it opens. It takes the count because the
   * label is the control's whole accessible name, and the count it shows would otherwise go unannounced.
   */
  label: (draftCount: number) => string
  /** How many drafts each turn kept; a turn absent from it offers nothing. */
  draftCounts: ReadonlyMap<string, number>
  /** Opens the named turn's drafts. */
  onOpen: (turnId: string) => void
}

/**
 * Props for a single {@link DefenseTurn}.
 */
type DefenseTurnProps = TurnActionsAffordance & {
  /** The message this turn renders. */
  turn: Turn
  /** Its 1-based place in the conversation, shown beside the role; null where nothing counts turns. */
  position: number | null
  /** Whether something outside the conversation currently points at this turn. */
  isPointedAt: boolean
  /** Picking the conversation up again from here; null where the reader keeps no place in it. */
  unreadMark: TurnUnreadMark | null
  /** Reading the drafts behind this reply; null where the reader isn't allowed to see them. */
  draftsMark: TurnDraftsMark | null
  /** How long the examiner took over this reply, in milliseconds; null where the reader is shown no timings. */
  durationMs: number | null
  /** The localized role label shown above the message. */
  label: string
  /** Whether this turn just arrived and should fade in. */
  animate: boolean
  /** Whether this reply has already been reported. */
  isReported: boolean
  /** Rewinds the conversation to this turn. */
  onRewind: () => void
  /**
   * Says what went wrong with this reply, or revises what was already said; null on a turn with nothing to
   * report.
   */
  onReport: (() => void) | null
}

/**
 * Renders one message of a defense conversation, styled by who authored it, with its body rendered as
 * read-only rich math.
 *
 * Its controls are never hover-revealed, and kept low-emphasis instead: a hover- or focus-toggled control
 * fights a Safari bug where the modal's `backdrop-filter` panel leaves hidden descendants painted as stale
 * ghosts, and a persistent control sidesteps it entirely.
 *
 * A standing report shows whichever way round, since acting on the conversation and seeing what was said
 * about it are two different things: a reader who can't change a report still has to see it.
 */
export function DefenseTurn({
  turn,
  position,
  isPointedAt,
  label,
  animate,
  isReported,
  canAct,
  rewindLabel,
  reportLabel,
  reportedLabel,
  onRewind,
  onReport,
  unreadMark,
  draftsMark,
  durationMs,
}: DefenseTurnProps) {
  // The look for this turn's author
  const style = TURN_STYLES[turn.role]

  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  // The entrance animation as decided at mount, so a transcript reconcile mid-fade can't cut it short
  const [entranceAnimation] = useState(animate)

  // The turn itself, which a draft the backend hasn't taken yet doesn't have. Pulled out because narrowing it
  // away doesn't survive into the control's own handler.
  const turnId = turn.id

  // How many drafts this reply went through, or null on one held before they were kept
  const draftCount =
    draftsMark === null || turnId === null ? null : (draftsMark.draftCounts.get(turnId) ?? null)

  return (
    <div
      data-turn-id={turnId ?? undefined}
      className={cn(
        'space-y-1.5',
        style.container,
        // A ring, not a tint: the tint is what says who authored the turn
        isPointedAt && 'rounded-lg ring-2 ring-inset ring-focus/60',
        // A role with no box of its own needs the padding for the ring to clear the text
        isPointedAt && !style.hasOwnBox && 'px-4 py-3',
        entranceAnimation &&
          !reducedMotion &&
          'animate-in fade-in slide-in-from-bottom-2 duration-300 transition-none'
      )}
    >
      {/* The author label, with the turn's controls at the row's trailing edge so they never cover the
          message body */}
      <div className="flex items-center justify-between gap-2">
        {/* Where the turn sits, who authored it, and how long it took them */}
        <div className="flex min-w-0 items-baseline gap-2">
          {position !== null && (
            <span className="text-[11px] font-bold tabular-nums text-muted">{position}</span>
          )}

          <div className={cn(TURN_LABEL_CLASS, style.label)}>{label}</div>

          {durationMs !== null && (
            <span className="text-[11px] tabular-nums text-muted">
              {formatDurationMs(durationMs)}
            </span>
          )}
        </div>

        {/* The turn's controls, and whatever has already been said about it */}
        {(canAct ||
          isReported ||
          draftCount !== null ||
          (unreadMark !== null && turnId !== null)) && (
          <div className={cn('flex shrink-0 items-center gap-0.5', style.actionsInset)}>
            {/* Say what went wrong with a reply. A reported one keeps the control and carries a filled flag,
                so the student can see what they said and change it */}
            {canAct && onReport !== null && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={isReported ? reportedLabel : reportLabel}
                onClick={onReport}
                className={cn(
                  'size-7 hover:text-foreground',
                  isReported ? 'text-muted-foreground' : 'text-muted/60'
                )}
              >
                <Flag size={14} className={cn(isReported && 'fill-current')} />
              </Button>
            )}

            {/* The same mark with nothing to click, for a reader who is only reading */}
            {!canAct && isReported && (
              <span
                role="img"
                aria-label={reportedLabel}
                className="flex size-7 items-center justify-center text-muted-foreground"
              >
                <Flag size={14} className="fill-current" aria-hidden="true" />
              </span>
            )}

            {/* Rewind the conversation to this turn */}
            {canAct && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={rewindLabel}
                onClick={onRewind}
                className="size-7 text-muted/60 hover:text-foreground"
              >
                <Undo2 size={14} />
              </Button>
            )}

            {/* Read the drafts this reply went through before it was sent. A reply that took more than one
                carries how many, since a run that had to be sent back is the one worth opening */}
            {draftCount !== null && turnId !== null && draftsMark !== null && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={draftsMark.label(draftCount)}
                onClick={() => draftsMark.onOpen(turnId)}
                className="relative size-7 text-muted/60 hover:text-foreground"
              >
                <Layers size={14} />
                {draftCount > 1 && (
                  <span className="absolute right-0 top-0 text-[9px] font-semibold leading-none">
                    {draftCount}
                  </span>
                )}
              </Button>
            )}

            {/* Pick the conversation up again from here. Every turn's reads the same: the line drawn across
                the transcript is what says where the reading currently stops */}
            {unreadMark !== null && turnId !== null && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={unreadMark.label}
                onClick={() => unreadMark.onMark(turnId)}
                className="size-7 text-muted/60 hover:text-foreground"
              >
                <Mail size={14} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* The message body as read-only rich math */}
      <div className={style.body}>
        <RichMathEditorRenderer content={turn.content} lightImageBackground={false} />
      </div>
    </div>
  )
}
