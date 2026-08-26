import { assertNever } from '@/components/shared/utils/assert-never'

import { isPracticeGroup } from './hosted-competition-state'
import type { EntryReadiness, HostedCompetitionGroup } from './hosted-competition-types'

/**
 * Whether a student has given everything a result of theirs would need.
 *
 * @param readiness - What the student has given of themselves so far.
 *
 * @returns Whether anything is still missing.
 */
function isProfileComplete(readiness: EntryReadiness): boolean {
  // A name to publish the result under, and a way to reach the student behind it
  return readiness.hasUsername && readiness.hasAnsweredGraduation && readiness.hasEmail
}

/**
 * What stands between a reader and any entry at all, in the order the reader meets them: there is no
 * profile to ask about before there is an account.
 */
export type EntryBlocker = 'signIn' | 'profile'

/**
 * Who is reading the page, and what the program knows about them. One value rather than a profile beside
 * a flag beside a wait, the states excluding each other.
 */
export type EntryReader = UnknownReader | SignedOutReader | SignedInReader | UnreadReader

/**
 * Nobody has settled who is reading, so nothing on the page is about them yet.
 */
type UnknownReader = {
  /** The discriminant. */
  kind: 'unknown'
}

/**
 * No account, which is the first thing an entry needs.
 */
type SignedOutReader = {
  /** The discriminant. */
  kind: 'signedOut'
}

/**
 * An account, and what the student has given of themselves.
 */
type SignedInReader = {
  /** The discriminant. */
  kind: 'signedIn'
  /** What the student has given of themselves so far. */
  readiness: EntryReadiness
}

/**
 * An account, and a profile nothing could be read out of.
 *
 * Its own state rather than an empty profile, which would read as a student who filled nothing in.
 */
type UnreadReader = {
  /** The discriminant. */
  kind: 'unread'
}

/**
 * What stands between this reader and entering one group.
 *
 * A profile nobody could read counts as one still owed. The practice group publishes nothing, so it never
 * asks for the fields a published result would name a student by; an account it still wants, an entry
 * having to belong to somebody.
 *
 * @param reader - Who is reading, and what is known about them.
 * @param group - The group they are reaching for.
 *
 * @returns What is in the way, null when nothing is, and undefined while that is still being settled.
 */
export function entryBlockerFor(
  reader: EntryReader,
  group: HostedCompetitionGroup
): EntryBlocker | null | undefined {
  switch (reader.kind) {
    // Nothing to say about somebody nobody has identified yet
    case 'unknown':
      return undefined

    // No account, so the entry would have nobody to belong to, whichever group it is
    case 'signedOut':
      return 'signIn'

    // An account, but nothing came back to say what it holds, which only a graded group needs to know
    case 'unread':
      return isPracticeGroup(group) ? null : 'profile'

    // An account, so it comes down to what the student has given of themselves, and to whether this group
    // would ever publish it
    case 'signedIn':
      return isProfileComplete(reader.readiness) || isPracticeGroup(group) ? null : 'profile'

    // Every reader is handled above
    default:
      return assertNever(reader)
  }
}

/**
 * What the page's header names as standing between this reader and the competitions on it.
 *
 * Only a graded group ever wants the profile fields, so a board holding none has nothing to say about
 * them, though it still wants an account. A reader who has asked to stop being told about their profile
 * is not told again.
 *
 * @param reader - Who is reading, and what is known about them.
 * @param groups - Every group on the board.
 *
 * @returns The step to name, or null when there is none.
 */
export function headerBlocker(
  reader: EntryReader,
  groups: HostedCompetitionGroup[]
): EntryBlocker | null {
  // The group the sentence is about. Every graded one asks the same, and a board holding only the practice
  // one still wants an account for it
  const subject = groups.find((group) => !isPracticeGroup(group)) ?? groups[0]

  // Nothing on the board, so there is no step to name
  if (subject === undefined) {
    return null
  }

  // What that group asks of them. An answer still being settled is no step to name either
  const blocker = entryBlockerFor(reader, subject) ?? null

  // Whether they have asked to stop being told about their profile
  const hasHiddenProfilePrompt =
    reader.kind === 'signedIn' && reader.readiness.hasHiddenProfilePrompt

  // Said unless it is the profile and they have asked to be rid of it
  return blocker === 'profile' && hasHiddenProfilePrompt ? null : blocker
}
