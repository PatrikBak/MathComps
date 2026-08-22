import { assertNever } from '@/components/shared/utils/assert-never'

import type { EntryReadiness } from './hosted-competition-types'

/**
 * Whether a student has given everything a result of theirs would be published under.
 *
 * @param readiness - What the student has given of themselves so far.
 *
 * @returns Whether anything is still missing.
 */
function isProfileComplete(readiness: EntryReadiness): boolean {
  // Three things the results cannot name a student without
  return (
    readiness.nickname !== null && readiness.graduationYear !== null && readiness.hasVerifiedEmail
  )
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
 * Whether the reader has an account, which is what an entry hangs off. A reader nobody has settled yet
 * counts as not having one.
 *
 * @param reader - Who is reading.
 *
 * @returns Whether there is an account.
 */
export function hasAccount(reader: EntryReader): boolean {
  // An account either way, whether or not anything could be read off it
  return reader.kind === 'signedIn' || reader.kind === 'unread'
}

/**
 * What stands between this reader and any entry, named once for everything that has to say it.
 *
 * A profile nobody could read counts as one still owed.
 *
 * @param reader - Who is reading, and what is known about them.
 *
 * @returns What is in the way, null when nothing is, and undefined while that is still being settled.
 */
export function entryBlocker(reader: EntryReader): EntryBlocker | null | undefined {
  switch (reader.kind) {
    // Nothing to say about somebody nobody has identified yet
    case 'unknown':
      return undefined

    // No account, so the entry would have nobody to belong to
    case 'signedOut':
      return 'signIn'

    // An account, but nothing came back to say what it holds
    case 'unread':
      return 'profile'

    // An account, so it comes down to the fields a published result names a student by
    case 'signedIn':
      return isProfileComplete(reader.readiness) ? null : 'profile'

    // Every reader is handled above
    default:
      return assertNever(reader)
  }
}
