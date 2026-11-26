'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'

import { useCloseOnFinalizeLost } from '../hooks/use-close-on-finalize-lost'
import { useFinalizeBoard } from '../hooks/use-finalize-board'
import type { SelectionWrite } from '../hooks/use-selection-write'
import { canFinalize } from '../model/selection-state'
import type { Board, BoardPickingForCycle } from '../model/selection-types'

/**
 * Props for the {@link FinalizeDialog} component.
 */
type FinalizeDialogProps = {
  /** The board being finalized, into the rounds of the cycle it picks for. */
  board: BoardPickingForCycle
  /** Whether the dialog is open. */
  isOpen: boolean
  /** Closes the dialog. */
  onClose: () => void
  /**
   * Puts the focus where the board's Finalize stood, given the board as it stands, once the dialog has closed over a
   * board that lost it.
   */
  onFinalizeGone: (board: Board) => void
}

/**
 * Says which cycle's rounds a board fills and when they open, then finalizes it into them, closing once the
 * server has answered and the selection has been read again. A refusal closes the dialog too, its toast saying why
 * and the board behind it showing what changed. So does a read that takes the board's Finalize away, as
 * {@link useCloseOnFinalizeLost} says.
 * While the finalize is out the dialog stays open, since the finalize lands whatever the dialog does.
 */
export function FinalizeDialog({ board, isOpen, onClose, onFinalizeGone }: FinalizeDialogProps) {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // Finalizing the board
  const finalize = useFinalizeBoard()

  // The dialog closed, saying why, once a read takes the board's Finalize away
  useCloseOnFinalizeLost({
    board,
    isOpen,
    isFinalizing: finalize.pendingVariables !== null,
    onClose,
  })

  // A function which closes the dialog, unless the finalize is still out
  const close = () => {
    // A finalize on its way lands whether the dialog stays or not
    if (finalize.pendingVariables !== null) return

    // The dialog closes
    onClose()
  }

  // A function which, once the dialog has gone, gives focus to a stand-in for the board's Finalize button, which
  // was focused before the dialog opened and went away with the board finalized or no longer finalizable
  const handleClosed = () => {
    // A board still finalizable keeps its Finalize button, and the dialog hands focus back to it
    if (canFinalize(board)) return

    // The focus goes to the stand-in for the Finalize button
    onFinalizeGone(board)
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
      {/* What finalizing does, and the press that does it */}
      <FinalizeConfirm board={board} finalize={finalize} onCancel={close} onAnswered={onClose} />
    </Modal>
  )
}

/**
 * Props for the {@link FinalizeConfirm} component.
 */
type FinalizeConfirmProps = {
  /** The board being finalized, into the rounds of the cycle it picks for. */
  board: BoardPickingForCycle
  /** Finalizing the board, by its id. */
  finalize: SelectionWrite<string>
  /** Backs out of the dialog. */
  onCancel: () => void
  /** Runs once the server has answered the finalize, taken or refused, and the selection has been read again. */
  onAnswered: () => void
}

/**
 * Where the board's problems go and what happens to them, and the press that finalizes it. The press is
 * unavailable while the board can't be finalized.
 */
function FinalizeConfirm({ board, finalize, onCancel, onAnswered }: FinalizeConfirmProps) {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // Dates in the reader's language
  const format = useFormatter()

  // Whether the finalize is out
  const isFinalizing = finalize.pendingVariables !== null

  // The day the cycle's rounds open
  const opens = format.dateTime(new Date(board.cycle.opensAt), { day: 'numeric', month: 'long' })

  // A function which finalizes the board into its cycle
  const confirm = () => finalize.mutate(board.id, onAnswered)

  return (
    <>
      {/* What finalizing does */}
      <p className="text-sm text-muted-foreground">
        {t('intro', { cycle: board.cycle.name, date: opens })}
      </p>

      {/* Back out, or go */}
      <div className="mt-6 flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={isFinalizing} onClick={onCancel}>
          {tActions('cancel')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!canFinalize(board)}
          loading={isFinalizing}
          onClick={confirm}
        >
          {t('confirm')}
        </Button>
      </div>
    </>
  )
}
