'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { type RefObject, useId } from 'react'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

import { useFinalizeBoard } from '../hooks/use-finalize-board'
import { useFinalizeChoice } from '../hooks/use-finalize-choice'
import type { SelectionWrite } from '../hooks/use-selection-write'
import { type CycleMisfit, fitsCycle } from '../model/selection-state'
import type { Board, FinalizationWrite } from '../model/selection-types'

/**
 * Props for the {@link FinalizeDialog} component.
 */
type FinalizeDialogProps = {
  /** The board being finalized. */
  board: Board
  /** Whether the dialog is open. */
  isOpen: boolean
  /** Closes the dialog. */
  onClose: () => void
  /** What takes the focus once the board is finalized, the button that opened the dialog gone with it. */
  focusAfterFinalizeRef: RefObject<HTMLElement | null>
}

/**
 * Asks which cycle's rounds a board fills, then finalizes it into them, closing once the server has answered and
 * the selection has been read again. A refusal closes the dialog too, its toast saying why and the board behind
 * it showing what changed. A cycle whose rounds the papers don't pair up with says why, and can't be picked.
 * While the finalize is out the dialog stays open, since the finalize lands whatever the dialog does.
 */
export function FinalizeDialog({
  board,
  isOpen,
  onClose,
  focusAfterFinalizeRef,
}: FinalizeDialogProps) {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // Finalizing the board
  const finalize = useFinalizeBoard()

  // A function which closes the dialog, unless the finalize is still out
  const close = () => {
    // A finalize on its way ties the board to its cycle whether the dialog stays or not
    if (finalize.pendingVariables !== null) return

    // The dialog closes
    onClose()
  }

  // A function which, once the dialog has gone, gives focus to the stand-in for a finalized board's Finalize
  // button, which was focused before the dialog opened and went with the draft
  const handleClosed = () => {
    // A draft keeps its Finalize button, and the dialog hands focus back to it
    if (board.finalization === null) return

    // The focus goes to the stand-in for the Finalize button
    focusAfterFinalizeRef.current?.focus()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      onClosed={handleClosed}
      title={t('title', { board: board.name })}
      showCloseButton={false}
      // The page's prose hyphenation, kept out of the dialog's labels and sentences
      className="hyphens-none"
      // Nothing is focused ahead of the reader on a dialog whose primary button cannot be undone
      focusPanelOnOpen
    >
      {/* The choice of cycle */}
      <FinalizeChoice board={board} finalize={finalize} onCancel={close} onAnswered={onClose} />
    </Modal>
  )
}

/**
 * Props for the {@link FinalizeChoice} component.
 */
type FinalizeChoiceProps = {
  /** The board being finalized. */
  board: Board
  /** Finalizing the board. */
  finalize: SelectionWrite<FinalizationWrite>
  /** Backs out of the dialog. */
  onCancel: () => void
  /** Runs once the server has answered the finalize, taken or refused, and the selection has been read again. */
  onAnswered: () => void
}

/**
 * The cycles on offer and the press that finalizes into the one picked. It mounts with the dialog's content,
 * so every opening picks afresh.
 */
function FinalizeChoice({ board, finalize, onCancel, onAnswered }: FinalizeChoiceProps) {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // Dates in the reader's language
  const format = useFormatter()

  // The cycles on offer, the one the papers go into, and the ways to pick and confirm
  const { options, cycleId, pick, confirm } = useFinalizeChoice(board, finalize, onAnswered)

  // The name tying the cycles' radios into one group, kept off any other group on screen
  const groupName = useId()

  // Whether the finalize is out
  const isFinalizing = finalize.pendingVariables !== null

  return (
    <>
      {/* What finalizing does */}
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      {/* The cycles on offer, fixed while the finalize is out */}
      <fieldset className="mt-5 space-y-2" disabled={isFinalizing}>
        <legend className="mb-2 text-sm font-medium text-foreground">{t('legend')}</legend>
        {options.length === 0 && <p className="text-sm text-muted">{t('noCycles')}</p>}
        {options.map(({ cycle, misfit }) => {
          // Whether the papers pair up with this cycle's rounds
          const fits = fitsCycle(misfit)

          return (
            <label
              key={cycle.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                fits ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                cycle.id === cycleId
                  ? 'border-brand/60 bg-brand/10 text-foreground'
                  : 'border-foreground/10 text-muted hover:text-foreground'
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={cycle.id}
                checked={cycle.id === cycleId}
                disabled={!fits}
                onChange={() => pick(cycle.id)}
                className="form-radio mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{cycle.name}</span>
                {!fits && <MisfitLine misfit={misfit} problemCount={cycle.problemCount} />}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {t('opens', {
                  date: format.dateTime(new Date(cycle.opensAt), { day: 'numeric', month: 'long' }),
                })}
              </span>
            </label>
          )
        })}
      </fieldset>

      {/* Back out, or go */}
      <div className="mt-6 flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={isFinalizing} onClick={onCancel}>
          {tActions('cancel')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={cycleId === null}
          loading={isFinalizing}
          onClick={confirm}
        >
          {t('confirm')}
        </Button>
      </div>
    </>
  )
}

/**
 * Props for the {@link MisfitLine} component.
 */
type MisfitLineProps = {
  /** What keeps the papers out of the cycle's rounds. */
  misfit: CycleMisfit
  /** How many problems each of the cycle's rounds takes. */
  problemCount: number
}

/**
 * Why a board's papers don't pair up with a cycle's rounds, every reason in one line.
 */
function MisfitLine({ misfit, problemCount }: MisfitLineProps) {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // What each level is called
  const categoryName = useCategoryName()

  // Every reason the papers don't pair up with the rounds
  const reasons = [
    ...misfit.unmatched.map((paper) => t('noRound', { paper: paper.name })),
    ...misfit.wrongSize.map((paper) =>
      t('wrongSize', { paper: paper.name, slots: paper.slots.length, count: problemCount })
    ),
    ...misfit.uncovered.map((category) => t('noPaper', { category: categoryName(category) })),
  ]

  // Every reason, run together on one line
  return <span className="mt-0.5 block text-xs text-muted">{reasons.join('; ')}</span>
}
