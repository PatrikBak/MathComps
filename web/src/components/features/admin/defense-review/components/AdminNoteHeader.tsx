import { Check } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import type { AdminNote } from '../model/defense-review-types'

/**
 * Words where a note hangs in its conversation.
 *
 * The wording lives here rather than at each surface that shows a note, so the tab and the feed can't end up
 * describing one place two ways, and so a note's card can say it above an open revision in the same words its
 * header would have.
 *
 * @returns A function wording one note's anchor, given where in the conversation it hangs.
 */
export function useNoteAnchorLabel(): (turnSequence: number | null) => string {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // Against the conversation as a whole, or against one reply counted the way the conversation reads
  return (turnSequence) =>
    turnSequence === null ? t('wholeConversation') : t('reply', { sequence: turnSequence + 1 })
}

/**
 * Props for the {@link AdminNoteHeader} component.
 */
type AdminNoteHeaderProps = {
  /** The note the header describes. */
  note: AdminNote
  /** Where in the conversation the note hangs, counting from 0; null for the conversation as a whole. */
  turnSequence: number | null
  /** Who wrote it, worded the way the surface around it needs. */
  author: React.ReactNode
  /** What can be done with the note here, absent where nothing can. */
  actions?: React.ReactNode
}

/**
 * The header above a note: what it hangs off, who wrote it, when, what it names, and whether it is settled.
 *
 * Shared between the conversation's own notes and the cross-conversation feed so the two can't drift into
 * describing one state two ways. What differs between them rides in through the slots rather than as flags.
 *
 * It reads down rather than across. One line carrying all five parts plus whatever can be done with the note ran
 * to two wrapped rows of 11px text in a panel this narrow, and a longer name pushed the controls onto a line of
 * their own. The anchor leads on its own line because it is the part the reader is scanning for; everything else
 * is what they check once they have found the note.
 *
 * A settled note is marked in words as well as in the check, so the state never rests on colour alone, and the
 * day it was settled rides in the title: beside the day it was written, two dates would read as a range.
 */
export function AdminNoteHeader({ note, turnSequence, author, actions }: AdminNoteHeaderProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // Locale-aware value formatter
  const format = useFormatter()

  // Where the note hangs
  const anchorLabel = useNoteAnchorLabel()(turnSequence)

  return (
    <header className="flex flex-col gap-0.5">
      {/* The anchor row, with whatever can be done with the note */}
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{anchorLabel}</span>
        {actions !== undefined && <div className="-my-1 flex shrink-0 items-center">{actions}</div>}
      </div>

      {/* The byline: who wrote it, when, and how it stands */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        {author}
        <span>{format.dateTime(new Date(note.createdAt), { dateStyle: 'short' })}</span>
        {note.category !== null && (
          <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-muted-foreground">
            {t(`categories.${note.category}`)}
          </span>
        )}
        {note.resolvedAt !== null && (
          <span
            className="flex items-center gap-1 text-success"
            title={t('resolvedOn', {
              date: format.dateTime(new Date(note.resolvedAt), { dateStyle: 'short' }),
            })}
          >
            <Check size={12} aria-hidden="true" />
            {t('resolved')}
          </span>
        )}
      </div>
    </header>
  )
}
