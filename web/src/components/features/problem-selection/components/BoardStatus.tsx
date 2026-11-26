'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { Ref } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import { isDraft } from '../model/selection-state'
import type { Board, BoardStage } from '../model/selection-types'

/**
 * Props for the {@link BoardStatus} component.
 */
type BoardStatusProps = {
  /** The board on screen. */
  board: Board
  /** Handle onto the line. */
  ref: Ref<HTMLParagraphElement>
}

/**
 * The rounds a board picks for or went into, and the day they open or opened, in one line.
 */
export function BoardStatus({ board, ref }: BoardStatusProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // Dates in the reader's language
  const format = useFormatter()

  // A board picking for no cycle has no rounds to name
  if (board.cycle === null) return null

  // The key of the line's copy
  const statusKey = statusKeyOf(board.cycle.stage)

  // The day the board's rounds open
  const opens = format.dateTime(new Date(board.cycle.opensAt), {
    day: 'numeric',
    month: 'long',
  })

  return (
    <p
      ref={ref}
      // Focused when a read finalizes the board under a control it takes away
      tabIndex={-1}
      // In italics on a draft, which picks for its rounds but hasn't gone into them
      className={cn('mt-0.5 text-xs text-muted focus:outline-none', isDraft(board) && 'italic')}
    >
      {t(statusKey, { cycle: board.cycle.name, date: opens })}
    </p>
  )
}

/**
 * The key of a board's status-line copy: the rounds a draft picks for, or the ones a finalized board went into,
 * in the past once they have opened.
 *
 * @param stage - Where the board stands against its cycle.
 *
 * @returns The key of the line's copy.
 */
function statusKeyOf(stage: BoardStage): 'statusDraft' | 'statusFinalized' | 'statusOpened' {
  // By where the board stands against its cycle
  switch (stage) {
    case 'finalizable':
    case 'unfinalizable':
      return 'statusDraft'
    case 'finalized':
      return 'statusFinalized'
    case 'opened':
      return 'statusOpened'
    default:
      return assertNever(stage)
  }
}
