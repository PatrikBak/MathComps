'use client'

import { usePrevious } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { canFinalize, isDraft } from '../model/selection-state'
import type { BoardPickingForCycle } from '../model/selection-types'

/**
 * Options for {@link useCloseOnFinalizeLost}.
 */
type UseCloseOnFinalizeLostOptions = {
  /** The board the dialog finalizes, as the latest read of the selection has it. */
  board: BoardPickingForCycle
  /** Whether the dialog is open. */
  isOpen: boolean
  /** Whether the dialog's own finalize is out. */
  isFinalizing: boolean
  /** Closes the dialog. */
  onClose: () => void
}

/**
 * Closes the finalize dialog when a read of the selection takes the board's Finalize away, and says why: another
 * reviewer finalized the board, or it can no longer be finalized. It acts only while the dialog is open and its own
 * finalize is not out, since a finalize the reader sent answers for itself.
 *
 * @param options - The dialog's board, and where the dialog stands.
 */
export function useCloseOnFinalizeLost({
  board,
  isOpen,
  isFinalizing,
  onClose,
}: UseCloseOnFinalizeLostOptions): void {
  // Finalize-dialog copy
  const t = useTranslations('problemSelection.finalize')

  // Whether the board can be finalized
  const isFinalizable = canFinalize(board)

  // Whether the board could be finalized as of the previous render; undefined on the first
  const wasFinalizable = usePrevious(isFinalizable)

  // The dialog closed over a read that took the board's Finalize away
  useEffect(() => {
    // Only a read that took the board's Finalize away, while the open dialog waits on the reader
    if (!isOpen || isFinalizing || wasFinalizable !== true || isFinalizable) return

    // The reader told why: another reviewer finalized the board, or it can no longer be finalized
    toast.warning(
      isDraft(board) ? t('notTaken', { cycle: board.cycle.name }) : t('finalizedElsewhere')
    )

    // The dialog closed
    onClose()
  }, [board, isFinalizable, isFinalizing, isOpen, onClose, t, wasFinalizable])
}
