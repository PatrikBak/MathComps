'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useRef } from 'react'

import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'

import { useAdminNoteEditing } from '../hooks/use-admin-note-editing'
import { useAdminNotes } from '../hooks/use-admin-notes'
import { useRevealLandingNote } from '../hooks/use-reveal-landing-note'
import type { AdminNote } from '../model/defense-review-types'
import { AdminNoteCard } from './AdminNoteCard'
import { AdminNoteComposer } from './AdminNoteComposer'
import { NoteChoiceChip } from './NoteChoiceChip'
import { NoteChoiceRow } from './NoteChoiceRow'

/**
 * Props for the {@link DefenseReviewNotesTab} component.
 */
type DefenseReviewNotesTabProps = {
  /** The conversation being noted on. */
  sessionId: string
  /** What has already been written about it, newest first. */
  notes: AdminNote[]
  /** The conversation's turns, which a note can be pinned to one of. */
  turns: StoredTurn[]
  /** Which reply a new note will stand against; null for the conversation as a whole. */
  turnId: string | null
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Points a new note at another reply, or at the conversation as a whole. */
  onTurnIdChange: (turnId: string | null) => void
}

/**
 * Everything written about one conversation, and where more gets written.
 *
 * A note can stand against the conversation as a whole or against one of its replies; which reply is picked
 * here rather than from the transcript, so the reply the note is about stays on screen while it is written.
 * Which one is picked lives above this tab, since the transcript marks it as the reply being written about.
 *
 * The target chips past the first are bare numbers on screen, since a column of them spelled out in full says
 * the same four words eight times over; each still announces itself in full to assistive tech.
 *
 * One note is written at a time: opening an old one for revision stands the composer down to the way back out
 * of it, since a second editor identical to the first says nothing about which note either belongs to.
 *
 * A reader sent here from the cross-conversation feed came for one particular note, which is moved to and
 * marked: the tab opens on the composer and everything already written is below it.
 */
export function DefenseReviewNotesTab({
  sessionId,
  notes,
  turns,
  turnId,
  landingNoteId,
  onTurnIdChange,
}: DefenseReviewNotesTabProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // The writes themselves
  const { create, update, remove, setResolved } = useAdminNotes(sessionId)

  // The name tying this tab's reply chips into one radio group, kept off any other group on screen
  const targetGroupName = useId()

  // Which note is being revised, and which is being dropped
  const editing = useAdminNoteEditing(update, remove)

  // Where each turn sits in the conversation
  const turnPlaces = useMemo(() => new Map(turns.map((turn, index) => [turn.id, index])), [turns])

  // The replies a note can stand against: the examiner's turns rather than the student's own, and not the
  // opener, which is a canned greeting reading the same in every conversation
  const replies = useMemo(
    () => turns.filter((turn, index) => turn.role === 'examiner' && index > 0),
    [turns]
  )

  // The pane the notes are read in
  const paneRef = useRef<HTMLDivElement>(null)

  // Move to whichever note the reader was sent here for
  useRevealLandingNote(paneRef, landingNoteId)

  return (
    <div ref={paneRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
      {/* Where a new note gets written, which a revision open on an old one takes the place of */}
      {editing.editingId === null ? (
        <div className="flex flex-col gap-2">
          {/* The target chips: which reply the note stands against */}
          <NoteChoiceRow label={t('target')}>
            {[null, ...replies.map((reply) => reply.id)].map((candidateId) => {
              // Where the reply sits in the conversation, which is what names its chip
              const sequence = candidateId === null ? null : (turnPlaces.get(candidateId) ?? 0) + 1

              return (
                <NoteChoiceChip
                  key={candidateId ?? 'conversation'}
                  groupName={targetGroupName}
                  label={sequence === null ? t('wholeConversation') : String(sequence)}
                  accessibleLabel={
                    sequence === null ? t('onConversation') : t('onTurn', { sequence })
                  }
                  isSelected={turnId === candidateId}
                  onSelect={() => onTurnIdChange(candidateId)}
                />
              )
            })}
          </NoteChoiceRow>

          {/* The composer itself */}
          <AdminNoteComposer onSubmit={(content, category) => create(turnId, content, category)} />
        </div>
      ) : (
        /* The way back out of the revision to writing a new note */
        <Button variant="outline" size="sm" onClick={editing.cancelEditing}>
          <Plus size={14} aria-hidden="true" />
          {t('write')}
        </Button>
      )}

      {/* What has already been written */}
      <div className="mt-5 flex flex-col gap-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted">{t('empty')}</p>
        ) : (
          notes.map((note) => (
            <AdminNoteCard
              key={note.id}
              note={note}
              turnSequence={note.turnId === null ? null : (turnPlaces.get(note.turnId) ?? null)}
              isPointedAt={note.id === landingNoteId}
              // The revision open on it, standing in for what it says
              editor={
                editing.editingId === note.id ? (
                  <AdminNoteComposer
                    initialContent={note.content}
                    initialCategory={note.category}
                    onSubmit={(content, category) => editing.submitEdit(note.id, content, category)}
                    onCancel={editing.cancelEditing}
                  />
                ) : undefined
              }
              onEdit={editing.startEditing}
              onDelete={editing.startDeleting}
              onSetResolved={setResolved}
            />
          ))
        )}
      </div>

      {/* The question before a note is dropped, outside the list so dropping one doesn't take it along */}
      <ConfirmDialog
        isOpen={editing.deletingId !== null}
        onClose={editing.cancelDeleting}
        onConfirm={editing.confirmDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        variant="danger"
      />
    </div>
  )
}
