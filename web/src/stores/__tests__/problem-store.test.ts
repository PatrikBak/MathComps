// What the store's edits do to the problem they name. Whether an edited problem still belongs on the
// screen it was edited from is a question about the filters rather than about the store, and is
// answered in problem-view-membership.test.ts.

import { beforeEach, describe, expect, it } from 'vitest'

import { problemWith } from '@/components/features/problems/__tests__/support/problem-fixtures'
import { useProblemStore } from '@/stores/problem-store'

describe('editing a problem the store holds', () => {
  beforeEach(() => {
    // Each case starts from an empty store, since the store outlives a single test
    useProblemStore.getState().reset()
  })

  it('turns the like around, counting the reader out', () => {
    // A problem the reader has liked, that others have too
    useProblemStore.getState().upsertProblems([problemWith({ liked: true, likeCount: 4 })])

    // Unliked
    useProblemStore.getState().toggleProblemLike('problem')

    // The problem carries the reader's state and the count they just left
    expect(useProblemStore.getState().problems.problem.liked).toBe(false)
    expect(useProblemStore.getState().problems.problem.likeCount).toBe(3)
  })

  it('turns the like around, counting the reader in', () => {
    // A problem the reader has not liked, that others have
    useProblemStore.getState().upsertProblems([problemWith({ liked: false, likeCount: 4 })])

    // Liked
    useProblemStore.getState().toggleProblemLike('problem')

    // The reader joins the count they were not part of
    expect(useProblemStore.getState().problems.problem.liked).toBe(true)
    expect(useProblemStore.getState().problems.problem.likeCount).toBe(5)
  })

  it('turns the mark around', () => {
    // An unmarked problem
    useProblemStore.getState().upsertProblems([problemWith()])

    // Marked
    useProblemStore.getState().toggleProblemMark('problem')

    // Which the problem now says
    expect(useProblemStore.getState().problems.problem.marked).toBe(true)
  })

  it('records a problem put into a list', () => {
    // A problem in no list at all
    useProblemStore.getState().upsertProblems([problemWith()])

    // Put into one
    useProblemStore.getState().toggleListMembership('problem', 'list-a')

    // Which the problem itself now names
    expect(useProblemStore.getState().problems.problem.listContentIds).toEqual(['list-a'])
  })

  it('records a problem taken out of one', () => {
    // A problem in two lists
    useProblemStore
      .getState()
      .upsertProblems([problemWith({ listContentIds: ['list-a', 'list-b'] })])

    // Taken out of one of them
    useProblemStore.getState().toggleListMembership('problem', 'list-a')

    // Which it no longer names, while the other stands
    expect(useProblemStore.getState().problems.problem.listContentIds).toEqual(['list-b'])
  })
})

describe('holding the problems themselves', () => {
  beforeEach(() => {
    // Each case starts from an empty store, since the store outlives a single test
    useProblemStore.getState().reset()
  })

  it('keeps the problems a later page knows nothing about', () => {
    // A page of problems
    useProblemStore
      .getState()
      .upsertProblems([problemWith({ slug: 'first' }), problemWith({ slug: 'second' })])

    // The page behind it, which names one of them again and one it has not seen
    useProblemStore
      .getState()
      .upsertProblems([
        problemWith({ slug: 'second', liked: true }),
        problemWith({ slug: 'third' }),
      ])

    // Every problem the reader has scrolled past is still there to be read
    expect(Object.keys(useProblemStore.getState().problems).sort()).toEqual([
      'first',
      'second',
      'third',
    ])

    // And the later page's word on a problem it names is the one that stands
    expect(useProblemStore.getState().problems.second.liked).toBe(true)
  })

  it('moves a comment count by what was added or taken away', () => {
    // A problem carrying a few comments
    useProblemStore.getState().upsertProblems([problemWith({ commentCount: 2 })])

    // One written
    useProblemStore.getState().updateCommentCount('problem', 1)

    // Which the count says
    expect(useProblemStore.getState().problems.problem.commentCount).toBe(3)

    // And one deleted
    useProblemStore.getState().updateCommentCount('problem', -1)

    // Which it says too
    expect(useProblemStore.getState().problems.problem.commentCount).toBe(2)
  })
})
