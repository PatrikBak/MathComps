// The conversation cache's matcher: which cached readings it reaches, and which it leaves where they are.

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { conversationDetailQueryKey, invalidateConversationDetail } from '../conversation-cache'

/** The languages every reading here is read in. */
const LANGUAGES = ['sk', 'en']

/**
 * Whether the cache holds the entry as owing a fresh read.
 *
 * @param queryClient - The cache to ask.
 * @param key - The entry.
 *
 * @returns Whether it was invalidated.
 */
function isStale(queryClient: QueryClient, key: readonly unknown[]): boolean {
  // Compared against true, since an entry nothing was ever parked at has no state to read at all
  return queryClient.getQueryState(key)?.isInvalidated === true
}

describe('invalidateConversationDetail', () => {
  it('reaches one conversation in every language and leaves another conversation alone', () => {
    // One conversation read in both languages
    const queryClient = new QueryClient()
    const written = LANGUAGES.map((locale) => {
      // Where that conversation read in this language lands
      const key = conversationDetailQueryKey('session', 'reader', locale)

      // Parked empty, since only whether the matcher reaches it is under test
      queryClient.setQueryData(key, {})

      // The key the case reads back by
      return key as readonly unknown[]
    })

    // A second conversation, which a note about the first says nothing about
    const untouched = conversationDetailQueryKey('other', 'reader', 'sk')
    queryClient.setQueryData(untouched, {})

    // A note written about the first
    invalidateConversationDetail(queryClient, 'session')

    // A note written under one reading has to reach the copy read in the other language
    written.forEach((key) => expect(isStale(queryClient, key)).toBe(true))

    // And reach nothing it says nothing about
    expect(isStale(queryClient, untouched)).toBe(false)
  })
})
