// The review cache's matchers: which cached entries each of them reaches, and which it leaves where they are.

import type { InfiniteData } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { PagedList } from '@/lib/api/paged-list'

import type {
  DefenseReviewConversation,
  DefenseReviewFilter,
} from '../../model/defense-review-types'
import {
  invalidateNoteFeed,
  invalidateReviewDetail,
  invalidateUnreadQueue,
  noteFeedQueryKey,
  patchCachedQueueConversations,
  reviewDetailQueryKey,
  reviewQueueQueryKey,
} from '../defense-review-cache'

/** The two languages the review surface is read in here. */
const LANGUAGES = ['sk', 'en']

/**
 * Builds one conversation's row.
 *
 * @param id - Which conversation it is.
 *
 * @returns The row.
 */
function conversationRow(id: string): DefenseReviewConversation {
  // A row nobody has written a note about yet
  return {
    id,
    target: { kind: 'handout', handoutContentId: 'handout', environmentId: 'environment' },
    user: { id: 'student', username: 'student', email: null },
    lastStudentMessage: null,
    turnCount: 1,
    lastActivityAt: '2026-01-01T00:00:00Z',
    readAt: null,
    unreadTurnCount: 1,
    noteCount: 0,
    hasStudentReport: false,
    hasStudentFeedback: false,
  }
}

/**
 * Answers one filtering of the queue and parks the answer in the cache, the way a screen drawn under it leaves
 * it there.
 *
 * @param queryClient - The cache to park it in.
 * @param filter - The filtering the pages were read under.
 * @param locale - The language they were read in.
 * @param conversationIds - The conversations the page came back with.
 *
 * @returns The key it is now held under.
 */
function cacheQueuePage(
  queryClient: QueryClient,
  filter: DefenseReviewFilter,
  locale: string,
  conversationIds: string[]
): readonly unknown[] {
  // Where a queue read under this filtering and language lands
  const key = reviewQueueQueryKey(filter, locale)

  // The one page it was answered with
  const page: PagedList<DefenseReviewConversation> = {
    items: conversationIds.map(conversationRow),
    page: 1,
    pageSize: 20,
    totalCount: conversationIds.length,
  }

  // Parked where a screen drawn under those filters would have left it
  queryClient.setQueryData<InfiniteData<PagedList<DefenseReviewConversation>>>(key, {
    pages: [page],
    pageParams: [1],
  })

  // The key the caller reads its pages back by
  return key
}

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

describe('invalidateUnreadQueue', () => {
  it('reaches the unread filtering and leaves every other one alone', () => {
    // A queue narrowed to the unread, and one narrowed to what the student reported
    const queryClient = new QueryClient()
    const unread = cacheQueuePage(queryClient, { unread: true }, 'sk', ['session'])
    const reported = cacheQueuePage(queryClient, { studentReported: true }, 'sk', ['session'])

    // A conversation marked read
    invalidateUnreadQueue(queryClient)

    // Only a queue narrowed to the unread can be falsified by a read mark
    expect(isStale(queryClient, unread)).toBe(true)
    expect(isStale(queryClient, reported)).toBe(false)
  })

  it('reaches that filtering in every language it was read in', () => {
    // The same narrowing, read once in each language
    const queryClient = new QueryClient()
    const keys = LANGUAGES.map((locale) =>
      cacheQueuePage(queryClient, { unread: true }, locale, ['session'])
    )

    // A conversation marked read
    invalidateUnreadQueue(queryClient)

    // A read mark is true of the conversation rather than of the reading, so both copies owe a fresh read
    keys.forEach((key) => expect(isStale(queryClient, key)).toBe(true))
  })

  it("never reads a key that is not the queue's", () => {
    // Somebody else's query, sitting in the same cache
    const queryClient = new QueryClient()
    const unread = cacheQueuePage(queryClient, { unread: true }, 'sk', ['session'])
    queryClient.setQueryData(['userProfile', 'user'], { username: 'student' })

    // A conversation marked read, which walks the whole cache looking for the queue
    invalidateUnreadQueue(queryClient)

    // The queue's own filtering is named by an object at the end of its key, and the read of it assumes as
    // much, so anything else has to be turned away by the prefix before the read is reached
    expect(isStale(queryClient, unread)).toBe(true)
    expect(isStale(queryClient, ['userProfile', 'user'])).toBe(false)
  })

  it('matches the unread field among others, and never a filtering without it', () => {
    // One narrowing carrying the unread field alongside another, and one carrying only the other
    const queryClient = new QueryClient()
    const alongside = cacheQueuePage(queryClient, { unread: true, hasNotes: true }, 'sk', [
      'session',
    ])
    const notUnread = cacheQueuePage(queryClient, { hasNotes: true }, 'sk', ['session'])

    // A conversation marked read
    invalidateUnreadQueue(queryClient)

    // Matched between the separators, so a field standing beside it doesn't hide it and can't stand in for it
    expect(isStale(queryClient, alongside)).toBe(true)
    expect(isStale(queryClient, notUnread)).toBe(false)
  })
})

describe('patchCachedQueueConversations', () => {
  it('rewrites the row in every language the queue was read in', () => {
    // Two conversations on one page, read once in each language
    const queryClient = new QueryClient()
    const keys = LANGUAGES.map((locale) =>
      cacheQueuePage(queryClient, { unread: true }, locale, ['session', 'other'])
    )

    // A note written about the first of them
    patchCachedQueueConversations(queryClient, ['session'], (conversation) => ({
      ...conversation,
      noteCount: conversation.noteCount + 1,
    }))

    // A note count is a fact about the conversation, so the language nobody was looking at moves too
    keys.forEach((key) => {
      // The pages as that language holds them
      const cached =
        queryClient.getQueryData<InfiniteData<PagedList<DefenseReviewConversation>>>(key)

      // The conversation the note was written about, and the one beside it left where it was
      expect(cached?.pages[0].items[0].noteCount).toBe(1)
      expect(cached?.pages[0].items[1].noteCount).toBe(0)
    })
  })
})

describe('invalidateNoteFeed', () => {
  it('reaches every narrowing in every language, and no queue', () => {
    // Both narrowings of the feed, each read in both languages
    const queryClient = new QueryClient()
    const feeds = LANGUAGES.flatMap((locale) =>
      [true, false].map((openOnly) => {
        // Where a feed read under this narrowing and language lands
        const key = noteFeedQueryKey(openOnly, locale)

        // Parked empty, since only whether the matcher reaches it is under test
        queryClient.setQueryData(key, { pages: [], pageParams: [] })

        // The key the case reads back by
        return key as readonly unknown[]
      })
    )

    // A queue alongside them, which the feed's own prefix must not reach
    const queue = cacheQueuePage(queryClient, { unread: true }, 'sk', ['session'])

    // A note written
    invalidateNoteFeed(queryClient)

    // The feed reads newest-first across every conversation, which a patch can't keep in order
    feeds.forEach((key) => expect(isStale(queryClient, key)).toBe(true))

    // The queue's own rows are patched instead, so nothing here may drag its pages back
    expect(isStale(queryClient, queue)).toBe(false)
  })
})

describe('invalidateReviewDetail', () => {
  it('reaches one conversation in every language and leaves another conversation alone', () => {
    // One conversation read in both languages
    const queryClient = new QueryClient()
    const written = LANGUAGES.map((locale) => {
      // Where that conversation read in this language lands
      const key = reviewDetailQueryKey('session', locale)

      // Parked empty, since only whether the matcher reaches it is under test
      queryClient.setQueryData(key, {})

      // The key the case reads back by
      return key as readonly unknown[]
    })

    // A second conversation, which a note about the first says nothing about
    const untouched = reviewDetailQueryKey('other', 'sk')
    queryClient.setQueryData(untouched, {})

    // A note written about the first
    invalidateReviewDetail(queryClient, 'session')

    // A note written under one reading has to reach the copy read in the other language
    written.forEach((key) => expect(isStale(queryClient, key)).toBe(true))

    // And reach nothing it says nothing about
    expect(isStale(queryClient, untouched)).toBe(false)
  })
})
