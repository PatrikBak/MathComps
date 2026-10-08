'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { categoryTextClass } from '@/components/features/hosted-competitions/components/CategoryBadge'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { useKeyedState } from '@/hooks/use-keyed-state'
import { localeCodeList } from '@/i18n/i18n'

import { useBoardSlot } from '../hooks/use-board-slot'
import type { SlotPosition } from '../model/selection-state'
import type { Paper } from '../model/selection-types'
import { SlotNumber, WARNING_MARK_CLASS } from './CategoryMarks'
import { ProposalLink } from './SelectionLinks'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * The board being filled: its papers, slot by slot.
 */
export function BoardPanel() {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // The selection, the problem open over the pool, and the way to put another board on screen
  const { selection, openProposalId, selectBoard } = useSelectionWorkspace()

  // Whether the papers show below the header on a narrow screen, where they fold away by default and again
  // whenever the open problem changes, closing included, so the problem a slot opens is what the screen shows
  const [isUnfolded, setIsUnfolded] = useKeyedState(openProposalId, false)

  // Only a stand-in until the boards arrive
  if (selection === null) {
    return <div className="h-72 animate-pulse rounded-xl bg-surface/25" aria-hidden />
  }

  // Every board, and the one on screen
  const { boards, activeBoard } = selection

  // The selection holds no board to fill
  if (activeBoard === null) {
    return (
      <div className={COMPACT_PANEL_CLASS}>
        <p className="text-sm text-muted">{t('none')}</p>
      </div>
    )
  }

  // Every slot on the board, across its papers
  const slots = activeBoard.papers.flatMap((paper) => paper.slots)

  // How many of the board's slots hold a problem
  const filled = slots.filter((slot) => slot !== null).length

  // A function which folds the papers away, or unfolds them
  const toggleFold = () => setIsUnfolded((unfolded) => !unfolded)

  return (
    <SurfacePanel as="section" radius="xl" aria-label={t('label')}>
      {/* Which board, and how full */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-3">
        {/* The board on screen, and the switch to any other */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'inline-flex min-w-0 items-center gap-1.5 rounded-md text-base font-semibold text-foreground',
              FOCUS_RING_CLASS
            )}
          >
            <span className="truncate">{activeBoard.name}</span>
            <ChevronDown size={16} className="shrink-0 text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            {boards.map((board) => (
              <DropdownMenuCheckboxItem
                key={board.id}
                checked={board.id === activeBoard.id}
                onCheckedChange={() => selectBoard(board.id)}
                className="justify-between gap-4"
              >
                {/* The board's name */}
                <span>{board.name}</span>

                {/* The board's stage: a draft until finalized, since a board whose rounds have opened has
                    left the selection */}
                <span className="text-xs text-muted">
                  {board.finalization === null ? t('draft') : t('finalized')}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* How full the board is */}
        <span className="ml-auto shrink-0 text-sm tabular-nums text-muted">
          {t('progress', { filled, total: slots.length })}
        </span>

        {/* The way to fold the papers away and back, on a narrow screen */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-expanded={isUnfolded}
          aria-label={isUnfolded ? t('fold') : t('unfold')}
          onClick={toggleFold}
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform', isUnfolded && 'rotate-180')}
          />
        </Button>
      </div>

      {/* The papers, hidden on a narrow screen until unfolded */}
      <div className={cn(!isUnfolded && 'hidden', 'lg:block')}>
        {/* Every paper, slot by slot */}
        {activeBoard.papers.map((paper) => (
          <PaperSlots key={paper.id} paper={paper} />
        ))}

        {/* Room under the last paper */}
        <div className="h-3" />
      </div>
    </SurfacePanel>
  )
}

/**
 * Props for the {@link PaperSlots} component.
 */
type PaperSlotsProps = {
  /** The paper. */
  paper: Paper
}

/**
 * One paper, slot by slot.
 */
function PaperSlots({ paper }: PaperSlotsProps) {
  // How many of the paper's slots hold a problem
  const filled = paper.slots.filter((slot) => slot !== null).length

  return (
    <div className="px-2 pt-3">
      {/* The paper's name in its category's colour, and how full it is */}
      <div className="flex items-baseline justify-between px-2 pb-1">
        <h3 className={cn('text-sm font-semibold', categoryTextClass(paper.category))}>
          {paper.name}
        </h3>
        <span className="text-xs tabular-nums text-muted">{`${filled}/${paper.slots.length}`}</span>
      </div>

      {/* Every slot */}
      <ol>
        {paper.slots.map((proposalId, index) => (
          <SlotRow key={index} paper={paper} index={index} proposalId={proposalId} />
        ))}
      </ol>
    </div>
  )
}

/**
 * Props for the {@link SlotRow} component.
 */
type SlotRowProps = SlotPosition & {
  /** The problem in the slot, by id; null when the slot stands empty. */
  proposalId: string | null
}

/**
 * One slot: empty, or holding a problem that opens in full.
 */
function SlotRow({ paper, index, proposalId }: SlotRowProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // The slot's problem, and the languages a round would refuse it in
  const { proposal, missingLanguages } = useBoardSlot(proposalId)

  // An empty slot
  if (proposal === undefined) {
    return (
      <li className="flex items-center gap-3 px-2 py-1.5 text-sm text-muted">
        <SlotNumber paper={paper} index={index} state="empty" />
        {t('empty')}
      </li>
    )
  }

  // The languages a round would refuse the problem in, as a sentence; undefined when there are none
  const missingLabel =
    missingLanguages.length > 0
      ? t('missingLanguages', { languages: localeCodeList(missingLanguages) })
      : undefined

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      {/* The slot's short label */}
      <SlotNumber paper={paper} index={index} state="filled" />

      {/* The problem, opening it in full */}
      <ProposalLink
        proposalId={proposal.id}
        className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-link"
        plain
      >
        <span className="tabular-nums text-muted">{`#${proposal.number} `}</span>
        {proposal.title}
      </ProposalLink>

      {/* The languages a round would refuse the problem in, which block finalizing */}
      {missingLabel !== undefined && (
        <span
          title={missingLabel}
          className={cn(WARNING_MARK_CLASS, 'shrink-0 px-1 text-[10px] font-semibold')}
        >
          {/* The bare codes, which on their own say nothing about what they mark */}
          <span aria-hidden="true" className="uppercase">
            {missingLanguages.join(' ')}
          </span>

          {/* What the codes mean, for a reader that gets neither them nor the hover */}
          <span className="sr-only">{missingLabel}</span>
        </span>
      )}
    </li>
  )
}
