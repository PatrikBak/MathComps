import { Check, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

import { type AdminNote, describeReviewUser } from '../model/defense-review-types'
import { AdminNoteHeader, useNoteAnchorLabel } from './AdminNoteHeader'
import { AdminNoteSurface } from './AdminNoteSurface'

/**
 * Props for the {@link AdminNoteCard} component.
 */
type AdminNoteCardProps = {
  /** The note to show. */
  note: AdminNote
  /** Where in the conversation it hangs, counting from 0; null for the conversation as a whole. */
  turnSequence: number | null
  /** Whether it is the note the reader was brought here for. */
  isPointedAt: boolean
  /** The revision open on it, standing in for what it says while one is. */
  editor?: React.ReactNode
  /** Opens it for revising. */
  onEdit: (noteId: string) => void
  /** Drops it. */
  onDelete: (noteId: string) => void
  /** Settles it, or puts it back to standing. */
  onSetResolved: (noteId: string, resolved: boolean) => void
}

/**
 * One note, as an annotation rather than a voice in the conversation.
 *
 * Rewriting or dropping a note is only its own reviewer's to do, so offering either on somebody else's would
 * be offering a move the server refuses. Settling one stays open to anybody.
 *
 * A revision happens on the card rather than beside it: an editor of its own would stand identical to the one
 * new notes are written in, leaving two boxes on screen with nothing saying which note either belongs to. Only
 * where it hangs is kept overhead while it is open, since the rest of what the header says is either being
 * rewritten in the box below or a move that has no meaning mid-revision.
 */
export function AdminNoteCard({
  note,
  turnSequence,
  isPointedAt,
  editor,
  onEdit,
  onDelete,
  onSetResolved,
}: AdminNoteCardProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // Profile copy
  const tProfile = useTranslations('profile')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Whether it has been settled
  const isResolved = note.resolvedAt !== null

  // Whether it is open for revising, which is what having a revision to show means
  const isEditing = editor !== undefined

  // Where it hangs
  const anchorLabel = useNoteAnchorLabel()(turnSequence)

  // A revision takes the card over, and takes the fade of a settled note with it: what is being rewritten
  // has to stay legible
  if (isEditing) {
    return (
      <AdminNoteSurface
        noteId={note.id}
        isResolved={false}
        isPointedAt={isPointedAt}
        padding="tight"
      >
        {/* Which note the revision is on */}
        <p className="truncate text-xs font-medium text-foreground">{anchorLabel}</p>

        {/* The revision itself */}
        <div className="mt-1.5">{editor}</div>
      </AdminNoteSurface>
    )
  }

  return (
    <AdminNoteSurface
      noteId={note.id}
      isResolved={isResolved}
      isPointedAt={isPointedAt}
      padding="tight"
    >
      {/* The note's header: where it hangs, and what can be done with it */}
      <AdminNoteHeader
        note={note}
        turnSequence={turnSequence}
        // The only name on this header, so it reads as a signature
        author={
          <span className="text-muted-foreground">
            {describeReviewUser(note.author, tProfile('defaultUser'))}
          </span>
        }
        actions={
          // Three marks on one dense line have no room for words, so each carries its name as a hover hint
          // as well as in the accessibility tree
          <>
            {/* Settle it, or put it back to standing */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={isResolved ? t('reopen') : t('resolve')}
              title={isResolved ? t('reopen') : t('resolve')}
              onClick={() => onSetResolved(note.id, !isResolved)}
              className="size-7"
            >
              {isResolved ? <Undo2 size={13} /> : <Check size={13} />}
            </Button>

            {/* Revise and drop, on the reviewer's own notes */}
            {note.isOwn && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tActions('edit')}
                  title={tActions('edit')}
                  onClick={() => onEdit(note.id)}
                  className="size-7"
                >
                  <Pencil size={13} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tActions('delete')}
                  title={tActions('delete')}
                  onClick={() => onDelete(note.id)}
                  className="size-7 hover:bg-error/10 hover:text-error"
                >
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </>
        }
      />

      {/* What it says, rendered the way it was written */}
      <div className="mt-1.5 text-sm text-muted-foreground">
        <RichMathEditorRenderer
          content={note.content}
          lightImageBackground={false}
          imageContext="userUploads"
        />
      </div>
    </AdminNoteSurface>
  )
}
