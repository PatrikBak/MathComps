'use client'

import { useReducedMotion } from '@mantine/hooks'
import { Flag, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'

import type { Turn, TurnRole } from '../model/defense-types'

/**
 * The controls a turn carries and their accessible labels. Shared by the transcript, which offers them on every
 * turn, and each turn, which renders the ones it was told to offer. Both controls answer the same question,
 * whether the conversation is saved and settled, so one flag governs them.
 */
export type TurnActionsAffordance = {
  /** Whether to offer the turn's own controls. */
  canAct: boolean
  /** The accessible label for the rewind control. */
  rewindLabel: string
  /** The accessible label for the report control. */
  reportLabel: string
  /** The accessible label the report control takes once the reply has been reported. */
  reportedLabel: string
}

/**
 * Props for a single {@link DefenseTurn}.
 */
type DefenseTurnProps = TurnActionsAffordance & {
  /** The message this turn renders. */
  turn: Turn
  /** The localized role label shown above the message. */
  label: string
  /** Whether this turn just arrived and should fade in. */
  animate: boolean
  /** Whether this reply has already been reported. */
  isReported: boolean
  /** Rewinds the conversation to this turn. */
  onRewind: () => void
  /**
   * Says what went wrong with this reply, or revises what was already said; null on a turn there is nothing
   * to report, which is what withholds the control.
   */
  onReport: (() => void) | null
}

/**
 * The per-role look of a turn: both read as full-width blocks, the examiner as the bare ambient voice
 * and the student as a brand-tinted card, distinguished by tint and font voice. The brand violet is the
 * examiner's own color, so her label carries it and the student's stays neutral.
 */
type TurnStyle = {
  /** Classes for the turn's outer container. */
  container: string
  /** Classes for the role label. */
  label: string
  /** Classes for the message body: the examiner speaks in the serif math voice, the student in sans. */
  body: string
  /** Classes cancelling the container's own inset, so every turn's controls share one axis. */
  actionsInset: string
}

/** The container/label/body styling for each role. */
const TURN_STYLES: Record<TurnRole, TurnStyle> = {
  examiner: {
    container: '',
    label: 'text-brand-light',
    body: 'math-typography',
    actionsInset: '',
  },
  candidate: {
    container: 'rounded-lg bg-brand/10 px-4 py-3',
    label: 'text-muted',
    body: 'text-[15px] leading-relaxed',
    actionsInset: '-mr-4',
  },
}

/**
 * Renders one message of a defense conversation, styled by who authored it, with its body rendered as
 * read-only rich math.
 */
export function DefenseTurn({
  turn,
  label,
  animate,
  isReported,
  canAct,
  rewindLabel,
  reportLabel,
  reportedLabel,
  onRewind,
  onReport,
}: DefenseTurnProps) {
  // The look for this turn's author
  const style = TURN_STYLES[turn.role]

  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  // The entrance animation as decided at mount, so a transcript reconcile mid-fade can't cut it short
  const [entranceAnimation] = useState(animate)

  return (
    <div
      className={cn(
        'space-y-1.5',
        style.container,
        entranceAnimation &&
          !reducedMotion &&
          'animate-in fade-in slide-in-from-bottom-2 duration-300'
      )}
    >
      {/* The author label, with the turn's controls at the row's trailing edge so they never cover the
          message body */}
      <div className="flex items-center justify-between gap-2">
        {/* Who authored the turn */}
        <div className={cn('text-[11px] font-bold uppercase tracking-wide', style.label)}>
          {label}
        </div>

        {/* The turn's controls. Always shown, kept low-emphasis: a hover- or focus-toggled control fights a
            Safari bug where the modal's `backdrop-filter` panel leaves hidden descendants painted as stale
            ghosts, and a persistent control sidesteps it entirely */}
        {canAct && (
          <div className={cn('flex shrink-0 items-center gap-0.5', style.actionsInset)}>
            {/* Say what went wrong with a reply. A reported one keeps the control and carries a filled flag,
                so the student can see what they said and change it */}
            {onReport !== null && (
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

            {/* Rewind the conversation to this turn */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={rewindLabel}
              onClick={onRewind}
              className="size-7 text-muted/60 hover:text-foreground"
            >
              <Undo2 size={14} />
            </Button>
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
