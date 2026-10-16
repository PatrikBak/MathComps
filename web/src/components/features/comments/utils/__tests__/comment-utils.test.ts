import { describe, expect, it } from 'vitest'

import type { CommentDto, CommentReactionDto } from '../../services/comment-api-types'
import { pressReaction, saysNothingNew, shouldHideComment } from '../comment-utils'

/** Another reader's thumbs-up, there before anybody presses anything. */
const MARTIN_UP: CommentReactionDto = { userId: 'user_martin', name: 'Martin', kind: 'thumbsUp' }

/** The presser's thumbs-up. */
const PETO_UP: CommentReactionDto = { userId: 'user_peto', name: 'Peťo', kind: 'thumbsUp' }

/** The presser's thumbs-down. */
const PETO_DOWN: CommentReactionDto = { userId: 'user_peto', name: 'Peťo', kind: 'thumbsDown' }

/** Zuzana's comment as posted, never edited. */
const POSTED: CommentDto = {
  id: 'comment-1',
  author: { id: 'user_zuzana', name: 'Zuzana', avatarUrl: null },
  content: 'Too easy for the opener.',
  createdAt: '2026-10-01T08:00:00.000Z',
  editedAt: null,
  isDeleted: false,
  reactions: [],
  replies: [],
}

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

describe('saysNothingNew', () => {
  it('treats an edit as news and a deletion after it as none, matching the comment across its new id', () => {
    // Zuzana's comment as she edited it, saved under a new id
    const edited = {
      ...POSTED,
      id: 'comment-2',
      content: 'Too easy for the opener, fine for the second slot.',
      editedAt: '2026-10-02T08:00:00.000Z',
    }

    // Zuzana's comment as she then deleted it
    const deleted = { ...edited, content: '', isDeleted: true }

    // The edited comment is news
    expect(saysNothingNew([POSTED], [edited])).toBe(false)

    // The same comment deleted after its edit is no news
    expect(saysNothingNew([POSTED], [deleted])).toBe(true)
  })

  it('treats a deleted comment as news when its author or posting time differs from the one it replaces', () => {
    // Martin's comment, posted the same moment and deleted
    const martins = {
      ...POSTED,
      id: 'comment-3',
      author: { id: 'user_martin', name: 'Martin', avatarUrl: null },
      content: '',
      isDeleted: true,
    }

    // Another of Zuzana's, posted a minute later and deleted
    const hersLater = {
      ...POSTED,
      id: 'comment-4',
      createdAt: '2026-10-01T08:01:00.000Z',
      content: '',
      isDeleted: true,
    }

    // Martin's deleted comment where Zuzana's stood is news
    expect(saysNothingNew([POSTED], [martins])).toBe(false)

    // Zuzana's later deleted comment where her first stood is news
    expect(saysNothingNew([POSTED], [hersLater])).toBe(false)
  })
})
