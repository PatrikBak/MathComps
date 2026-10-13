import { describe, expect, it } from 'vitest'

import type { CommentReactionDto } from '../../services/comment-api-types'
import { pressReaction, shouldHideComment } from '../comment-utils'

/** Another reader's thumbs-up, there before anybody presses anything. */
const MARTIN_UP: CommentReactionDto = { userId: 'user_martin', name: 'Martin', kind: 'thumbsUp' }

/** The presser's thumbs-up. */
const PETO_UP: CommentReactionDto = { userId: 'user_peto', name: 'Peťo', kind: 'thumbsUp' }

/** The presser's thumbs-down. */
const PETO_DOWN: CommentReactionDto = { userId: 'user_peto', name: 'Peťo', kind: 'thumbsDown' }

describe('pressReaction', () => {
  it('takes back the reaction the presser holds when they press it again', () => {
    // Peťo presses the same thumbs-up again
    const reactions = pressReaction([PETO_UP, MARTIN_UP], PETO_UP)

    // Martin's alone
    expect(reactions).toEqual([MARTIN_UP])
  })

  it('swaps the presser to the other reaction rather than giving them a second', () => {
    // Peťo, holding the thumbs-up, presses the thumbs-down
    const reactions = pressReaction([PETO_UP, MARTIN_UP], PETO_DOWN)

    // Martin's untouched, Peťo's swapped and now the newest
    expect(reactions).toEqual([MARTIN_UP, PETO_DOWN])
  })
})

describe('shouldHideComment', () => {
  it('keeps a chain of deleted comments while a live reply sits at the bottom of it', () => {
    // A deleted comment with a deleted reply, which somebody still answered
    const hidden = shouldHideComment({
      isDeleted: true,
      replies: [{ isDeleted: true, replies: [{ isDeleted: false, replies: [] }] }],
    })

    // Kept, so the live answer has a place to hang
    expect(hidden).toBe(false)
  })

  it('drops a chain of deleted comments with nothing live anywhere under it', () => {
    // A deleted comment whose only reply is deleted too
    const hidden = shouldHideComment({
      isDeleted: true,
      replies: [{ isDeleted: true, replies: [] }],
    })

    // Dropped whole
    expect(hidden).toBe(true)
  })
})
