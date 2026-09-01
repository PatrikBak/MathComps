'use client'

import type { QueryUiState } from '@/lib/query-ui-state'

import type { AreaEntry, CompetitionInGroup } from '../model/hosted-competition-state'
import { findCompetitionInGroup, toAreaEntry } from '../model/hosted-competition-state'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { useHostedCompetitionsView } from './use-hosted-competitions-view'

/**
 * Return type for {@link useAreaEntry}.
 */
type UseAreaEntryResult = {
  /** The competition and its group; undefined while the read has not landed, and for one the view has not got. */
  competitionInGroup: CompetitionInGroup | undefined
  /** The entry the reader spent on it; null while they have spent none, and while the read has not landed. */
  entry: AreaEntry | null
  /** How far the read behind it got, so a caller can wait rather than read an absent entry as none. */
  uiState: QueryUiState
}

/**
 * The entry a reader holds in one competition, as everything about one of its problems reads it.
 *
 * Read off the view every competitions surface already reads, so a conversation opened away from the
 * competition's own area is held to the same clock as one opened inside it.
 *
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param isReaderKnown - Whether who the answer belongs to is settled yet.
 * @param competitionSlug - Which competition the entry is into, null while there is no competition in hand.
 *
 * @returns The entry, the competition it is into, and the state of the read.
 */
export function useAreaEntry(
  readerKey: HostedCompetitionsReaderKey,
  isReaderKnown: boolean,
  competitionSlug: string | null
): UseAreaEntryResult {
  // Every competition the reader can see, which the board has usually already fetched. A caller with no
  // competition in hand has nothing to find in it, so it goes unread
  const { view, uiState } = useHostedCompetitionsView(
    readerKey,
    isReaderKnown && competitionSlug !== null
  )

  // The one this entry is into, and the group whose terms it runs on
  const competitionInGroup =
    competitionSlug === null ? undefined : findCompetitionInGroup(view, competitionSlug)

  // What the reader spent on it, with the group's clock already applied
  const entry =
    competitionInGroup === undefined
      ? null
      : toAreaEntry(competitionInGroup.group, competitionInGroup.competition.entry)

  // The entry, what it is into, and how far the read behind both got
  return { competitionInGroup, entry, uiState }
}
