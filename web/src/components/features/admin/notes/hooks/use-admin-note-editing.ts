import { useCallback, useState } from 'react'

import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'

/**
 * What {@link useAdminNoteEditing} hands back.
 */
type UseAdminNoteEditingResult = {
  /** Which note is open for revising; null while none is. */
  editingId: string | null
  /** Opens one for revising. */
  startEditing: (noteId: string) => void
  /** Abandons the revision, leaving the note as it stands. */
  cancelEditing: () => void
  /** Files a revision, reporting whether it landed. */
  submitEdit: (
    noteId: string,
    content: string,
    category: DefenseReportCategory | null
  ) => Promise<boolean>
  /** Which note is being dropped; null while none is. */
  deletingId: string | null
  /** Asks whether to drop one. */
  startDeleting: (noteId: string) => void
  /** Leaves it where it is. */
  cancelDeleting: () => void
  /** Drops the one being asked about. */
  confirmDelete: () => void
}

/**
 * Which note is being revised, and which is being dropped.
 *
 * The two are held together because they are the same state to a reader: one note at a time is the one being
 * acted on. Which one is being dropped outlives the list re-rendering underneath it, so the question survives
 * the note it is about moving.
 *
 * @param update - Revises a note, reporting whether the write landed.
 * @param remove - Drops a note.
 * @returns The state described by {@link UseAdminNoteEditingResult}.
 */
export function useAdminNoteEditing(
  update: (
    noteId: string,
    content: string,
    category: DefenseReportCategory | null
  ) => Promise<boolean>,
  remove: (noteId: string) => void
): UseAdminNoteEditingResult {
  // Which note is open for revising
  const [editingId, setEditingId] = useState<string | null>(null)

  // Which note is being dropped
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Files a revision. The editor closes only once it has landed, so a failure leaves it open on the text.
  const submitEdit = useCallback(
    async (noteId: string, content: string, category: DefenseReportCategory | null) => {
      // Whether the revision landed
      const written = await update(noteId, content, category)

      // Only then is the text somewhere other than the editor
      if (written) setEditingId(null)

      // Handed back so the caller knows whether it landed
      return written
    },
    [update]
  )

  // Drops whichever note the question is about
  const confirmDelete = useCallback(() => {
    // Nothing to drop if the question was answered on its way out
    if (deletingId !== null) remove(deletingId)

    // Either way the question is over
    setDeletingId(null)
  }, [deletingId, remove])

  // Abandons the revision, leaving the note as it stands
  const cancelEditing = useCallback(() => setEditingId(null), [])

  // Leaves the note being asked about where it is
  const cancelDeleting = useCallback(() => setDeletingId(null), [])

  // Which note each of the two flows is on, and the moves along them
  return {
    editingId,
    startEditing: setEditingId,
    cancelEditing,
    submitEdit,
    deletingId,
    startDeleting: setDeletingId,
    cancelDeleting,
    confirmDelete,
  }
}
