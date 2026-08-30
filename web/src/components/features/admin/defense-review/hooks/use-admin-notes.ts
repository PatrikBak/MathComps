import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { AdminNote } from '../model/defense-review-types'
import {
  createAdminNote,
  deleteAdminNote,
  setAdminNoteResolved,
  updateAdminNote,
} from '../services/defense-review-service'
import {
  invalidateNoteFeed,
  invalidateReviewDetail,
  patchCachedQueueConversation,
} from './defense-review-cache'

/**
 * A note being written.
 */
type NoteCreate = {
  /** Marks a note being written. */
  kind: 'create'
  /** The reply to write against, or null for the conversation as a whole. */
  turnId: string | null
  /** What it says. */
  content: string
  /** Which failure it names, or null to name none. */
  category: DefenseReportCategory | null
}

/**
 * A note being revised.
 */
type NoteUpdate = {
  /** Marks a note being revised. */
  kind: 'update'
  /** The note. */
  noteId: string
  /** What it should now say. */
  content: string
  /** Which failure it should now name, or null to name none. */
  category: DefenseReportCategory | null
}

/**
 * A note being dropped.
 */
type NoteDelete = {
  /** Marks a note being dropped. */
  kind: 'delete'
  /** The note. */
  noteId: string
}

/**
 * A note being settled, or put back to standing.
 */
type NoteResolve = {
  /** Marks a note being settled or put back to standing. */
  kind: 'resolve'
  /** The note. */
  noteId: string
  /** True to settle it, false to put it back. */
  resolved: boolean
}

/**
 * What one write against a conversation's notes says.
 */
type NoteWrite = NoteCreate | NoteUpdate | NoteDelete | NoteResolve

/**
 * One write against a conversation's notes, carried together with the conversation it was issued against.
 *
 * The conversation travels with the write rather than being read off the hook's argument when the write lands,
 * because stepping to the next conversation while one is in flight would otherwise settle it against whichever
 * one the reader had moved on to.
 */
type NoteWriteRequest = {
  /** The conversation the write was issued against. */
  sessionId: string
  /** What the write says. */
  write: NoteWrite
}

/**
 * What {@link useAdminNotes} hands back.
 */
type UseAdminNotesResult = {
  /** Writes a note about the conversation, optionally against one of its replies, and reports whether it landed. */
  create: (
    turnId: string | null,
    content: string,
    category: DefenseReportCategory | null
  ) => Promise<boolean>
  /** Revises a note, and reports whether the revision landed. */
  update: (
    noteId: string,
    content: string,
    category: DefenseReportCategory | null
  ) => Promise<boolean>
  /** Drops a note. */
  remove: (noteId: string) => void
  /** Settles a note, or puts it back to standing. */
  setResolved: (noteId: string, resolved: boolean) => void
}

/**
 * Writes what gets noted down about one conversation.
 *
 * The conversation is read back afterwards rather than patched: its notes come down with it, and a note's
 * server-side stamps are not something the client can invent. The queue's row is patched instead, since
 * refetching the queue would reorder it under the reader.
 *
 * @param sessionId - The conversation being noted on.
 * @returns The writes as described by {@link UseAdminNotesResult}.
 */
export function useAdminNotes(sessionId: string): UseAdminNotesResult {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The cache the conversation and its row live in
  const queryClient = useQueryClient()

  // Every write against the conversation's notes. A failure surfaces as a toast rather than passing quietly,
  // since the note being written is text somebody just typed.
  const { mutateAsync } = useOptimisticMutation<AdminNote | void, NoteWriteRequest, void>({
    apiFn: async (apiCall, { sessionId: writtenAgainst, write }) => {
      // Each kind of write goes to its own endpoint
      switch (write.kind) {
        // A note filed against the conversation or one of its replies
        case 'create':
          return createAdminNote(
            apiCall,
            writtenAgainst,
            write.turnId,
            write.content,
            write.category
          )

        // A revision of one already filed
        case 'update':
          return updateAdminNote(apiCall, write.noteId, write.content, write.category)

        // One taken back
        case 'delete':
          return deleteAdminNote(apiCall, write.noteId)

        // One settled, or put back to standing
        case 'resolve':
          return setAdminNoteResolved(apiCall, write.noteId, write.resolved)

        // A write outside the union, which the type system rules out
        default:
          return assertNever(write)
      }
    },
    onSuccess: (_result, { sessionId: writtenAgainst, write }) => {
      // The conversation carries its own notes, so it has to be read again to show what just changed
      invalidateReviewDetail(queryClient, writtenAgainst)

      // The feed reads newest-first across every conversation, which a patch can't keep in order
      invalidateNoteFeed(queryClient)

      // Only writing or dropping one changes how many the queue's row reports
      if (write.kind === 'create' || write.kind === 'delete') {
        // The row's count, one up or one down
        patchCachedQueueConversation(queryClient, writtenAgainst, (conversation) => ({
          ...conversation,
          noteCount: conversation.noteCount + (write.kind === 'create' ? 1 : -1),
        }))
      }
    },
    authReason: t('notes.writeFailed'),
    errorMessage: t('notes.writeFailed'),
  })

  // Runs one write, saying whether it landed. A write the auth gate blocked resolves to nothing rather than
  // throwing, and letting go of typed text on that is the same loss as letting go of it on a failure.
  const runWrite = useCallback(
    async (write: NoteWrite) => {
      // Handed over, and answered for either way
      try {
        // The write itself. Only the auth gate turning it away resolves to nothing: a write that landed with
        // nothing to say, as dropping and settling both do, still answers with the empty body's object.
        return (await mutateAsync({ sessionId, write })) !== undefined
      } catch {
        // The failure has already been said out loud; the caller only needs to know it didn't land
        return false
      }
    },
    [mutateAsync, sessionId]
  )

  // Writes a note
  const create = useCallback(
    (turnId: string | null, content: string, category: DefenseReportCategory | null) =>
      runWrite({ kind: 'create', turnId, content, category }),
    [runWrite]
  )

  // Revises one
  const update = useCallback(
    (noteId: string, content: string, category: DefenseReportCategory | null) =>
      runWrite({ kind: 'update', noteId, content, category }),
    [runWrite]
  )

  // Drops one
  const remove = useCallback(
    (noteId: string) => void runWrite({ kind: 'delete', noteId }),
    [runWrite]
  )

  // Settles one, or puts it back
  const setResolved = useCallback(
    (noteId: string, resolved: boolean) => void runWrite({ kind: 'resolve', noteId, resolved }),
    [runWrite]
  )

  // Every write against the conversation's notes
  return { create, update, remove, setResolved }
}
