import { useMemo, useState } from 'react'

import { indexReports } from '@/components/features/defense/model/defense-conversation-model'
import type { DefenseTurnReport } from '@/components/features/defense/model/defense-types'

import type { AdminConversation, DefenseTurnAttempt } from '../model/admin-conversation'
import { resolveTurnDurationsMs } from '../model/turn-durations'

/**
 * What {@link useAdminTranscript} hands back.
 */
type UseAdminTranscriptResult = {
  /** What the student holds against each reply, by reply. */
  reports: ReadonlyMap<string, DefenseTurnReport>
  /** How many drafts each reply kept, by reply. */
  draftCounts: ReadonlyMap<string, number>
  /** How long each turn took its author, by turn. */
  turnDurationsMs: ReadonlyMap<string, number>
  /** The drafts behind the reply being read, in the order they were made; null while none is. */
  openDrafts: DefenseTurnAttempt[] | null
  /** Starts reading the drafts behind a reply. */
  readDrafts: (turnId: string) => void
  /** Stops reading the drafts. */
  closeDrafts: () => void
}

/**
 * What an admin transcript reads off a conversation beyond its turns, and which reply's drafts are being read.
 *
 * @param conversation - The conversation being read.
 *
 * @returns What each turn carries beyond its text, and the drafts being read.
 */
export function useAdminTranscript(conversation: AdminConversation): UseAdminTranscriptResult {
  // Which reply's drafts are being read; null while none are
  const [draftsTurnId, setDraftsTurnId] = useState<string | null>(null)

  // The drafts kept per reply, hand-folded rather than through Map.groupBy, which no browser older than
  // Safari 17.4 has and nothing here polyfills
  const attemptsByTurn = useMemo(
    () =>
      conversation.attempts.reduce(
        (groups, attempt) =>
          groups.set(attempt.turnId, [...(groups.get(attempt.turnId) ?? []), attempt]),
        new Map<string, DefenseTurnAttempt[]>()
      ),
    [conversation.attempts]
  )

  // How many drafts each reply kept
  const draftCounts = useMemo(
    () => new Map([...attemptsByTurn].map(([turnId, attempts]) => [turnId, attempts.length])),
    [attemptsByTurn]
  )

  // How long each turn took its author
  const turnDurationsMs = useMemo(
    () => resolveTurnDurationsMs(conversation.turns, attemptsByTurn),
    [conversation.turns, attemptsByTurn]
  )

  // What the student holds against each reply
  const reports = useMemo(() => indexReports(conversation.reports), [conversation.reports])

  // The drafts behind the reply being read, where that reply is one of this conversation's
  const openDrafts = draftsTurnId === null ? null : (attemptsByTurn.get(draftsTurnId) ?? null)

  // A function which starts reading the drafts behind a reply
  const readDrafts = (turnId: string) => setDraftsTurnId(turnId)

  // A function which stops reading the drafts
  const closeDrafts = () => setDraftsTurnId(null)

  // What each turn carries beyond its text, and the drafts being read
  return { reports, draftCounts, turnDurationsMs, openDrafts, readDrafts, closeDrafts }
}
