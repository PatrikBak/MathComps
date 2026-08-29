'use client'

import { useNow } from '@/hooks/use-now'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { EntryBlocker } from '../model/entry-reader'
import { headerBlocker } from '../model/entry-reader'
import { orderForReading } from '../model/hosted-competition-state'
import type { HostedCompetitionGroup, PendingEntry } from '../model/hosted-competition-types'
import { useDismissProfilePrompt } from './use-dismiss-profile-prompt'
import { useEntryGuard } from './use-entry-guard'
import { useEntryReader } from './use-entry-reader'
import type { UseHostedCompetitionEntryDialogResult } from './use-hosted-competition-entry-dialog'
import { useHostedCompetitionEntryDialog } from './use-hosted-competition-entry-dialog'
import { useHostedCompetitionsView } from './use-hosted-competitions-view'

/**
 * Return type for {@link useHostedCompetitionsBoard}.
 */
type UseHostedCompetitionsBoardResult = {
  /** Every group the reader can see, most actionable first. */
  groups: HostedCompetitionGroup[]
  /** How far the list has got, which who is reading decides as much as the read does. */
  listState: QueryUiState
  /** The one instant every deadline on the page is read against, in epoch milliseconds. */
  now: number
  /** The step the header names, or null while the reader owes nothing. */
  gateBlocker: EntryBlocker | null
  /** Whether the dialog has to put the rules in front of the student before it takes an entry. */
  needsRulesAccept: boolean
  /** What the entry dialog is asking about, and the ways to answer it. */
  dialog: UseHostedCompetitionEntryDialogResult
  /** What one entry press turns into, given what the group pressed asks of the reader. */
  enterCompetition: (pending: PendingEntry) => void
  /** Hides the unfinished-profile sentence for good. */
  dismissProfilePrompt: () => void
}

/**
 * Every competition the program has run or will run, as the board reads them: the groups in the order a
 * reader wants them, what the reader still owes before any of it can be pressed, and where a press goes.
 *
 * @param entryIntentId - Which competition a press made before signing in was aimed at.
 *
 * @returns What the board draws, and the calls its presses go through.
 */
export function useHostedCompetitionsBoard(
  entryIntentId: string | undefined
): UseHostedCompetitionsBoardResult {
  // Who is reading, and what the program knows about them
  const { reader, readerKey, isReaderKnown } = useEntryReader()

  // Every competition the student can see
  const { view, uiState } = useHostedCompetitionsView(readerKey, isReaderKnown)

  // The question standing between a press and a running clock
  const dialog = useHostedCompetitionEntryDialog(readerKey)

  // One clock for the page, so every deadline on it moves on the same tick
  const now = useNow()

  // Every group, most actionable first
  const groups = view === undefined ? [] : orderForReading(view.groups, now)

  // What a press turns into, given what the group they pressed asks of them
  const enterCompetition = useEntryGuard({
    reader,
    groups,
    openDialog: dialog.open,
    entryIntentId,
    hasView: view !== undefined,
  })

  // The list waits on who is reading as well as on its own fetch: drawn any earlier, a signed-in student
  // is offered the sign-in press
  const listState: QueryUiState = reader.kind === 'unknown' ? { kind: 'loading' } : uiState

  // Hiding the profile sentence for good
  const { dismissProfilePrompt } = useDismissProfilePrompt(readerKey)

  // A reader the program does not know yet has accepted nothing, so everyone but a signed-in student who
  // already has is asked again
  const needsRulesAccept = reader.kind !== 'signedIn' || !reader.readiness.hasAcceptedRules

  // What the board draws, and what its presses go through
  return {
    groups,
    listState,
    now,
    needsRulesAccept,
    gateBlocker: headerBlocker(reader, groups),
    dialog,
    enterCompetition,
    dismissProfilePrompt,
  }
}
