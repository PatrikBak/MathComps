'use client'

import type { SetStateAction } from 'react'
import { create } from 'zustand'

/**
 * A reply open under a comment.
 */
type OpenReply = {
  /** The comment it answers. */
  commentId: string
  /** The reader who opened it. */
  readerId: string | null
}

/**
 * The reply open across the site, and the way to move it.
 */
type OpenReplyState = {
  /** The open reply, or null while none is open. */
  openedUnder: OpenReply | null
  /** Opens the reply under a comment, or closes it with null. */
  setOpenedUnder: (next: SetStateAction<OpenReply | null>) => void
}

/**
 * The one reply open across the site. Opening a reply anywhere closes the one open before, its draft kept, and
 * sending it from any thread closes it in every other thread showing the same comment. It outlasts the threads
 * showing it, so a thread shown again finds it as it was left. It belongs to the reader who opened it, so nobody
 * signing in after them finds it open.
 */
export const useOpenReply = create<OpenReplyState>((set) => ({
  openedUnder: null,
  setOpenedUnder: (next) =>
    set((state) => ({
      openedUnder: typeof next === 'function' ? next(state.openedUnder) : next,
    })),
}))
