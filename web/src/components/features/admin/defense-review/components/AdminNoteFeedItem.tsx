'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { DefenseTargetLabel } from '@/components/features/defense/components/DefenseTargetLabel'
import { Button } from '@/components/shared/components/Button'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

import {
  type AdminNoteFeedItem as FeedItem,
  describeReviewUser,
} from '../model/defense-review-types'
import { AdminNoteHeader } from './AdminNoteHeader'
import { AdminNoteSurface } from './AdminNoteSurface'

/**
 * Props for the {@link AdminNoteFeedItem} component.
 */
type AdminNoteFeedItemProps = {
  /** The note, and enough of where it was written to be read on its own. */
  item: FeedItem
  /** Opens the conversation it was written about, standing on the note itself. */
  onOpenNote: (sessionId: string, noteId: string) => void
}

/**
 * One note in the cross-conversation feed, carrying the conversation it came out of.
 *
 * The way into that conversation stands beside the note rather than under it: the control is taller than the
 * line naming the conversation, so a row of its own opens a gap the length of the button under every one-line
 * title. The student's name leads the card, since a note read out of its conversation is otherwise about
 * nobody.
 */
export function AdminNoteFeedItem({ item, onOpenNote }: AdminNoteFeedItemProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Profile copy
  const tProfile = useTranslations('profile')

  return (
    <AdminNoteSurface
      noteId={item.note.id}
      isResolved={item.note.resolvedAt !== null}
      isPointedAt={false}
      padding="roomy"
    >
      <div className="flex items-start justify-between gap-3">
        {/* The note itself */}
        <div className="min-w-0 flex-1">
          {/* Which conversation it was written about */}
          <p className="flex min-w-0 items-baseline gap-2 text-sm">
            <span className="truncate font-medium text-foreground">
              {describeReviewUser(item.user, tProfile('defaultUser'))}
            </span>

            <DefenseTargetLabel target={item.target} emphasis="muted" />
          </p>

          {/* Where in that conversation it hangs, and who wrote it */}
          <div className="mt-1">
            <AdminNoteHeader
              note={item.note}
              turnSequence={item.turnSequence}
              // Said as a phrase rather than bare, since the student's own name already leads the card
              author={
                <span className="text-muted-foreground">
                  {t('notes.byAuthor', {
                    author: describeReviewUser(item.note.author, tProfile('defaultUser')),
                  })}
                </span>
              }
            />
          </div>

          {/* What it says */}
          <div className="mt-1.5 text-sm text-muted-foreground">
            <RichMathEditorRenderer
              content={item.note.content}
              lightImageBackground={false}
              imageContext="comments"
            />
          </div>
        </div>

        {/* The way into that conversation */}
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onOpenNote(item.note.sessionId, item.note.id)}
        >
          {t('feed.open')}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </AdminNoteSurface>
  )
}
