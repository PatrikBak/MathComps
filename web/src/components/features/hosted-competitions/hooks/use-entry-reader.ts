'use client'

import { useAuth } from '@clerk/nextjs'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import type { EntryReader } from '../model/entry-reader'
import type { EntryReadiness } from '../model/hosted-competition-types'
import { fetchEntryReadiness } from '../services/hosted-competition-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { entryReadinessQueryKey } from './hosted-competition-cache'

/**
 * The answers {@link toReader} puts together.
 */
type ReaderAnswers = {
  /** Whether who is reading is settled at all. */
  isKnown: boolean
  /** Whether anybody is signed in. */
  isSignedIn: boolean
  /** What the profile read returned, undefined while it has returned nothing. */
  readiness: EntryReadiness | undefined
  /** Whether the profile read gave up. */
  hasFailed: boolean
}

/**
 * Puts the two reads together into the one thing the page asks about.
 *
 * @param answers - What each read has said so far.
 *
 * @returns Who is reading.
 */
function toReader({ isKnown, isSignedIn, readiness, hasFailed }: ReaderAnswers): EntryReader {
  // Clerk has not answered, so nothing else is worth asking
  if (!isKnown) {
    return { kind: 'unknown' }
  }

  // Nobody signed in has a profile to read, so their answer is settled the moment Clerk's is
  if (!isSignedIn) {
    return { kind: 'signedOut' }
  }

  // The profile, once it lands
  if (readiness !== undefined) {
    return { kind: 'signedIn', readiness }
  }

  // A read that gave up is an answer of its own; one still going is not
  return hasFailed ? { kind: 'unread' } : { kind: 'unknown' }
}

/**
 * Return type for {@link useEntryReader}.
 */
type UseEntryReaderResult = {
  /** Who is reading, and what the program knows about them. */
  reader: EntryReader
  /** Who every cached answer on this surface belongs to. */
  readerKey: HostedCompetitionsReaderKey
  /** Whether that is settled yet. */
  isReaderKnown: boolean
}

/**
 * Who is reading the page, and whether the program knows enough about them to let them sit anything: an
 * account, and the profile fields a result is published under. Both are settled here rather than at the
 * press, so the page can say what it wants before anybody reaches for a button.
 *
 * @returns Who is reading, and the key their answers are cached under.
 */
export function useEntryReader(): UseEntryReaderResult {
  // Who is reading, and whether that is settled yet
  const { isLoaded, isSignedIn: hasAccount, userId } = useAuth()

  // Whether anybody is signed in
  const isSignedIn = hasAccount === true

  // Whether who is reading is settled yet
  const isReaderKnown = isLoaded

  // Whose answers these are
  const readerKey: HostedCompetitionsReaderKey = userId ?? null

  // What the student has given, which only somebody signed in has any of
  const { data: readiness, uiState } = useApiQuery({
    queryKey: entryReadinessQueryKey(readerKey),
    fetch: fetchEntryReadiness,
    // The reader's own profile, so it is read as them
    requireAuth: true,
    // Nobody signed in has a profile to read, so the call is never made
    enabled: isSignedIn,
    // A field filled in on the profile in another tab should show up here promptly
    ...cachePolicy.userData,
  })

  // Who is reading, and where their answers live
  return {
    reader: toReader({
      isKnown: isReaderKnown,
      isSignedIn,
      readiness,
      hasFailed: uiState.kind === 'failed',
    }),
    readerKey,
    isReaderKnown,
  }
}
