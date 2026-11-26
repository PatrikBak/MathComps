'use client'

import { useTranslations } from 'next-intl'

import { finalizeBoard } from '../services/selection-service'
import { type SelectionWrite, useSelectionWrite } from './use-selection-write'

/**
 * Finalizing a board, by its id, into the rounds of the cycle it picks for. It waits for the server, which moves
 * every slotted problem.
 *
 * @returns The write.
 */
export function useFinalizeBoard(): SelectionWrite<string> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Finalizing the board, shown with the read after it
  return useSelectionWrite<string>({
    apiFn: finalizeBoard,
    edit: null,
    changesSlots: true,
    errorMessage: t('finalizeFailed'),
  })
}
