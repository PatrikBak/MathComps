'use client'

import { useDisclosure } from '@mantine/hooks'
import { useTranslations } from 'next-intl'

import type { Proposal } from '../model/selection-types'
import { useDetailTabCounts } from './use-detail-tab-counts'
import { useDeleteProposal } from './use-proposal-writes'

/**
 * Return type for {@link useProposalDeleteConfirmation}.
 */
type UseProposalDeleteConfirmationResult = {
  /** Whether the delete is waiting to be confirmed. */
  isConfirming: boolean
  /** Asks for the delete to be confirmed. */
  ask: () => void
  /** Drops the question. */
  dismiss: () => void
  /** Deletes the problem. */
  confirm: () => void
  /** What leaves the selection with the problem, in words; empty when nothing does. */
  attached: string[]
}

/**
 * Deleting a problem, behind a question saying what goes with it.
 *
 * @param proposal - The problem.
 * @param onDeleted - Runs as the delete fires, once the reader confirms it.
 *
 * @returns The question's state, the ways to answer it, and what the delete takes along.
 */
export function useProposalDeleteConfirmation(
  proposal: Proposal,
  onDeleted: (() => void) | undefined
): UseProposalDeleteConfirmationResult {
  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // Filing-line copy
  const tFiling = useTranslations('problemSelection.filing')

  // Whether the delete is waiting to be confirmed
  const [isConfirming, { open: ask, close: dismiss }] = useDisclosure(false)

  // How many conversations and comments the problem carries
  const counts = useDetailTabCounts(proposal.id)

  // What goes with the problem when it is deleted, each kind counted in words
  const attached = [
    counts.conversations > 0 && tPlurals('conversations', { count: counts.conversations }),
    counts.comments > 0 && tFiling('comments', { count: counts.comments }),
  ].filter((part) => part !== false)

  // Deleting the problem
  const remove = useDeleteProposal()

  // A function which deletes the problem once the reader confirms
  const confirm = () => {
    // The delete itself, unless the press is dropped behind another write still out
    if (!remove.mutate(proposal.id)) return

    // And the caller told at once, the problem having left every view already
    onDeleted?.()
  }

  // The question's state, the ways to answer it, and what the delete takes along
  return { isConfirming, ask, dismiss, confirm, attached }
}
