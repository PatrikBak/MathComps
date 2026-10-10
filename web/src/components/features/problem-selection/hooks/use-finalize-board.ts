'use client'

import { useTranslations } from 'next-intl'

import type { FinalizationWrite } from '../model/selection-types'
import { finalizeBoard } from '../services/selection-service'
import { type SelectionWrite, useSelectionWrite } from './use-selection-write'

/**
 * Finalizing a board into a cycle's rounds. It waits for the server, which moves every slotted problem.
 *
 * @returns The write.
 */
export function useFinalizeBoard(): SelectionWrite<FinalizationWrite> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Finalizing the board, shown with the read after it
  return useSelectionWrite<FinalizationWrite>({
    apiFn: finalizeBoard,
    edit: null,
    changesSlots: true,
    errorMessage: t('finalizeFailed'),
  })
}
