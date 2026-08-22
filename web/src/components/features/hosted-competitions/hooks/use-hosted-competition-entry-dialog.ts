'use client'

import { useCallback, useState } from 'react'

import type { PendingEntry } from '../model/hosted-competition-types'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { useEnterHostedCompetition } from './use-enter-hosted-competition'

/**
 * Return type for {@link useHostedCompetitionEntryDialog}.
 */
type UseHostedCompetitionEntryDialogResult = {
  /** What the dialog is asking about, or null while it is closed. */
  pending: PendingEntry | null
  /** Asks about a competition. */
  open: (pending: PendingEntry) => void
  /** Drops the question without entering. */
  close: () => void
  /** Answers it, which takes the entry and starts the clock. */
  confirm: () => void
  /** Answers it the other way, spending the entry on the problems and starting no clock. */
  forfeit: () => void
  /** Whether an entry or a forfeit is in flight. */
  isEntering: boolean
}

/**
 * The deliberate half of entering: which competition is being asked about, and taking the entry once the
 * student picks a category and says yes. The dialog closes on the entry landing rather than on the press,
 * so a failure leaves the question on screen instead of implying a clock that never started.
 *
 * @param readerKey - Who the cached answers belong to.
 *
 * @returns What the dialog is asking about, and the ways to answer it.
 */
export function useHostedCompetitionEntryDialog(
  readerKey: HostedCompetitionsReaderKey
): UseHostedCompetitionEntryDialogResult {
  // Which competition is being asked about
  const [pending, setPending] = useState<PendingEntry | null>(null)

  // A function which drops the question
  const close = useCallback(() => setPending(null), [])

  // Taking the entry, or giving it up, either of which closes the dialog once it lands
  const { enter, forfeit, isEntering } = useEnterHostedCompetition(readerKey, close)

  // A function which answers the question
  const confirm = useCallback(() => {
    // Nothing to enter while the dialog is closed
    if (pending === null) return

    // Take the entry into whichever competition was asked about
    enter(pending.competition.id)
  }, [enter, pending])

  // A function which answers it by giving the entry up for the problems
  const confirmForfeit = useCallback(() => {
    // Nothing to give up while the dialog is closed
    if (pending === null) return

    // Spend the entry on whichever competition was asked about
    forfeit(pending.competition.id)
  }, [forfeit, pending])

  // What the dialog is asking about, and the ways to answer it
  return { pending, open: setPending, close, confirm, forfeit: confirmForfeit, isEntering }
}
