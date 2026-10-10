import { describe, expect, it } from 'vitest'

import type { CommentTarget } from '../../services/comment-api-types'
import { commentDraftStorageKey } from '../comment-drafts'

/** A proposal's discussion in the problem selection. */
const THREAD: CommentTarget = { targetType: 'Proposal', targetId: 'proposal-4' }

describe('commentDraftStorageKey', () => {
  it('keeps a new comment under its thread, and a reply under the comment it answers', () => {
    // A new comment, kept under the reader and the thread
    expect(commentDraftStorageKey('user_2abc', THREAD, null)).toBe(
      'comment-draft:user_2abc:Proposal:proposal-4'
    )

    // A reply in the same thread, kept apart under the comment it answers
    expect(commentDraftStorageKey('user_2abc', THREAD, 'comment-7')).toBe(
      'comment-draft:user_2abc:Proposal:proposal-4:reply:comment-7'
    )
  })
})
