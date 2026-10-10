'use client'

import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { type ReactNode, type Ref, useId, useState } from 'react'

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

import { useBoardFocusKeeper } from '../hooks/use-board-focus-keeper'
import { useBoardSlot } from '../hooks/use-board-slot'
import { usePaperMoves, type UsePaperMovesResult } from '../hooks/use-paper-moves'
import { useSlotWrites } from '../hooks/use-slot-writes'
import { type BoardSlot, finalizeBlockers } from '../model/selection-state'
import type { Board, Paper } from '../model/selection-types'
import { SlotNumber, WARNING_MARK_CLASS } from './CategoryMarks'
import { FinalizeDialog } from './FinalizeDialog'
import { ProposalLink } from './SelectionLinks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * The board being filled: its papers, slot by slot, and what stands between it and the rounds. A placement
 * made from the pool or from a single problem shows up here at once.
 */
export function BoardPanel() {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // The selection, the problem open over the pool, and the way to put another board on screen
  const { selection, openProposalId, selectBoard } = useSelectionWorkspace()

  // Whether the papers show below the header on a narrow screen, where they fold away by default and again
  // whenever the open problem changes, closing included, so the problem a slot opens is what the screen shows
  const [isUnfolded, setIsUnfolded] = useKeyedState(openProposalId, false)

  // Where the focus goes when a read changes the board on screen under it
  const { menuRef, statusRef } = useBoardFocusKeeper(
    selection?.boards ?? [],
    selection?.activeBoard ?? null
  )

  // The board the finalize dialog asks about, by id; null while the dialog is closed
  const [finalizingBoardId, setFinalizingBoardId] = useState<string | null>(null)

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

  // A function which opens the finalize dialog for the board on screen
  const openFinalize = () => setFinalizingBoardId(activeBoard.id)

  // A function which closes the finalize dialog
  const closeFinalize = () => setFinalizingBoardId(null)

  return (
    <SurfacePanel as="section" radius="xl" aria-label={t('label')}>
      {/* Which board, and how full */}
      <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-3">
        {/* The board on screen, and the switch to any other */}
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={menuRef}
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

      {/* The status line, for a finalized board, shown folded or not */}
      <BoardStatus board={activeBoard} ref={statusRef} />

      {/* The papers and what stands between them and the rounds, hidden on a narrow screen until unfolded */}
      <div className={cn(!isUnfolded && 'hidden', 'lg:block')}>
        {/* Every paper, slot by slot */}
        {activeBoard.papers.map((paper) => (
          <PaperSlots key={paper.id} board={activeBoard} paper={paper} />
        ))}

        {/* The footer, with the way to finalize a draft */}
        <BoardFooter board={activeBoard} onFinalize={openFinalize} />
      </div>

      {/* Which rounds the board fills */}
      <FinalizeDialog
        board={activeBoard}
        isOpen={finalizingBoardId === activeBoard.id}
        onClose={closeFinalize}
        focusAfterFinalizeRef={statusRef}
      />
    </SurfacePanel>
  )
}

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
 * The rounds a finalized board went into, and the day they open, in one line.
 */
function BoardStatus({ board, ref }: BoardStatusProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // Dates in the reader's language
  const format = useFormatter()

  // A draft says nothing beyond its stage
  if (board.finalization === null) return null

  // The day the board's rounds open
  const opens = format.dateTime(new Date(board.finalization.opensAt), {
    day: 'numeric',
    month: 'long',
  })

  return (
    <p
      ref={ref}
      // Focused when a read finalizes the board under a control it takes away
      tabIndex={-1}
      className="px-4 pt-3 text-xs text-muted focus:outline-none"
    >
      {t('status', { cycle: board.finalization.cycleName, date: opens })}
    </p>
  )
}

/**
 * Props for the {@link PaperSlots} component.
 */
type PaperSlotsProps = {
  /** The board holding the paper. */
  board: Board
  /** The paper. */
  paper: Paper
}

/**
 * One paper, slot by slot.
 */
function PaperSlots({ board, paper }: PaperSlotsProps) {
  // The moves along the paper
  const moves = usePaperMoves({ board, paper })

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
      <ol ref={moves.listRef}>
        {paper.slots.map((_proposalId, index) => (
          <SlotRow key={index} board={board} paper={paper} index={index} moves={moves} />
        ))}
      </ol>
    </div>
  )
}

/**
 * Props for the {@link SlotRow} component.
 */
type SlotRowProps = BoardSlot & {
  /** The moves along the slot's paper. */
  moves: UsePaperMovesResult
}

/**
 * One slot. A draft's stands empty and waits to be picked, or holds a problem that can be moved, replaced or sent
 * back. A finalized board's only shows what its round holds.
 */
function SlotRow({ moves, ...slot }: SlotRowProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // The board, the paper and the position
  const { board, paper, index } = slot

  // The slot's problem, and whether it waits for another from the pool
  const { proposal, missingLanguages, isWaiting, toggleWaiting } = useBoardSlot(slot)

  // The slot's writes, whether each is available now, and the buttons a moved problem's focus follows it onto
  const {
    isClearing,
    moveUpRef,
    moveDownRef,
    canClear,
    canMoveUp,
    canMoveDown,
    moveUp,
    moveDown,
    clear,
  } = useSlotWrites(slot, moves)

  // The id of what comes next while an empty slot waits, which describes its button
  const hintId = useId()

  // Whether the slot takes changes, which a finalized board's never does
  const isDraft = board.finalization === null

  // An empty slot on a draft is one button: pick it, then pick a problem from the pool
  if (proposal === undefined && isDraft) {
    return (
      <li>
        <button
          type="button"
          // A slot emptied by its own Back to the pool takes the focus the pressed button had
          autoFocus={isClearing}
          aria-pressed={isWaiting}
          aria-describedby={isWaiting ? hintId : undefined}
          onClick={toggleWaiting}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
            FOCUS_RING_CLASS,
            isWaiting
              ? 'bg-brand/15 text-foreground'
              : 'text-muted hover:bg-foreground/[0.04] hover:text-foreground'
          )}
        >
          {/* The slot's short label */}
          <SlotNumber paper={paper} index={index} state={isWaiting ? 'highlighted' : 'empty'} />

          {/* What the slot holds, which names the button whether it waits or not */}
          <span className={cn(isWaiting && 'sr-only')}>{t('empty')}</span>

          {/* What comes next while the slot waits, read out as the button's description */}
          {isWaiting && (
            <span id={hintId} aria-hidden="true">
              {t('pickFromPool')}
            </span>
          )}
        </button>
      </li>
    )
  }

  // An empty slot on a finalized board, which only says so
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
    <li
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors',
        isWaiting && 'bg-brand/15',
        !isWaiting && isDraft && 'hover:bg-foreground/[0.04] focus-within:bg-foreground/[0.04]'
      )}
    >
      {/* The slot's short label */}
      <SlotNumber paper={paper} index={index} state={isWaiting ? 'highlighted' : 'filled'} />

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
        <>
          {/* The bare codes, which on their own say nothing about what they mark */}
          <span
            aria-hidden="true"
            title={missingLabel}
            className={cn(WARNING_MARK_CLASS, 'shrink-0 px-1 text-[10px] font-semibold uppercase')}
          >
            {missingLanguages.join(' ')}
          </span>

          {/* What the codes mean, for a reader that gets neither them nor the hover, whatever holds the focus */}
          <span className="sr-only">{missingLabel}</span>
        </>
      )}

      {/* What can be done with a draft's slot: always in reach of the keyboard and a screen reader, shown on
          hover and focus, and always shown on a device without hover. A slot whose own emptying was refused
          comes back holding its problem, the action pressed taking the focus again */}
      {isDraft && (
        <div
          className={cn(
            'flex shrink-0 items-center sr-only',
            'group-hover:not-sr-only group-focus-within:not-sr-only [@media(hover:none)]:not-sr-only'
          )}
        >
          {/* Having the slot wait for a replacement, or keeping its problem after all */}
          <SlotAction label={isWaiting ? t('keep') : t('replace')} onClick={toggleWaiting}>
            <ArrowLeftRight size={14} />
          </SlotAction>

          {/* Trading with the slot above, where there is one */}
          <SlotAction ref={moveUpRef} label={t('moveUp')} disabled={!canMoveUp} onClick={moveUp}>
            <ArrowUp size={14} />
          </SlotAction>

          {/* Trading with the slot below, where there is one */}
          <SlotAction
            ref={moveDownRef}
            label={t('moveDown')}
            disabled={!canMoveDown}
            onClick={moveDown}
          >
            <ArrowDown size={14} />
          </SlotAction>

          {/* Sending the problem back to the pool */}
          <SlotAction
            label={t('backToPool')}
            disabled={!canClear}
            autoFocus={isClearing}
            onClick={clear}
          >
            <X size={14} />
          </SlotAction>
        </div>
      )}
    </li>
  )
}

/**
 * Props for the {@link SlotAction} component.
 */
type SlotActionProps = {
  /** Handle onto the action's button. */
  ref?: Ref<HTMLButtonElement>
  /** What the action does, in words. */
  label: string
  /** Whether the action is unavailable. */
  disabled?: boolean
  /** Whether the action takes the focus as it appears. */
  autoFocus?: boolean
  /** Runs the action. */
  onClick: () => void
  /** The icon. */
  children: ReactNode
}

/**
 * One small icon action on a filled slot, named by its title.
 */
function SlotAction({
  ref,
  label,
  disabled = false,
  autoFocus = false,
  onClick,
  children,
}: SlotActionProps) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className="size-7"
      title={label}
      autoFocus={autoFocus}
      // Unavailable by its ARIA state alone, which keeps the focus on it through the press that makes it so
      aria-disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/**
 * Props for the {@link BoardFooter} component.
 */
type BoardFooterProps = {
  /** The board on screen. */
  board: Board
  /** Opens the finalize dialog. */
  onFinalize: () => void
}

/**
 * What stands between a draft board and the rounds, and the way to send it there.
 */
function BoardFooter({ board, onFinalize }: BoardFooterProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // Every proposal, by id
  const { proposalsById } = useLoadedSelection()

  // Whether a write changing the slots is still out
  const { isChangingSlots } = useSelectionWorkspace()

  // The id of the list of what still has to happen, which describes the press
  const blockersId = useId()

  // A finalized board has nothing left to finalize, leaving the footer a bare gap
  if (board.finalization !== null) return <div className="h-3" />

  // What stops the board going
  const blockers = finalizeBlockers(board, proposalsById)

  // Whether the board can go, with no slot empty and every problem ready
  const isReady = blockers.emptySlots === 0 && blockers.unready.length === 0

  return (
    <div className="mt-3 space-y-3 border-t border-foreground/10 px-4 py-3">
      {/* What still has to happen, if anything */}
      <ul id={blockersId} className="space-y-1.5 text-xs text-muted">
        {isReady && <li>{t('ready')}</li>}
        {blockers.emptySlots > 0 && <li>{t('emptyCount', { count: blockers.emptySlots })}</li>}
        {blockers.unready.map(({ proposal, languages }) => (
          <li key={proposal.id} className="flex gap-1.5">
            {/* The problem's number, opening it in full */}
            <ProposalLink
              proposalId={proposal.id}
              className="text-link hover:text-link-hover"
              plain
            >
              {`#${proposal.number}`}
            </ProposalLink>

            {/* What the problem still needs */}
            <span>{t('needsLanguages', { languages: localeCodeList(languages) })}</span>
          </li>
        ))}
      </ul>

      {/* The press opening the finalize dialog, unavailable by its ARIA state alone, so the focus a closing
          dialog hands back to it still lands once a refusal has left the board unable to go */}
      <Button
        variant="primary"
        size="sm"
        fullWidth
        aria-disabled={!isReady || isChangingSlots}
        aria-describedby={blockersId}
        onClick={onFinalize}
      >
        {t('finalize')}
      </Button>
    </div>
  )
}
