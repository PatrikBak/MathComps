'use client'

import { useTranslations } from 'next-intl'
import { type KeyboardEvent, useId } from 'react'

import { REPORT_CATEGORY_KEYS } from '@/components/features/defense/model/defense-feedback-options'
import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'

import { useAdminNoteDraft } from '../hooks/use-admin-note-draft'
import { NoteChoiceChip } from './NoteChoiceChip'
import { NoteChoiceRow } from './NoteChoiceRow'

/**
 * Every failure a note can name, in the order they read.
 *
 * Taken from the list a student's own report is filed on rather than written out again, which is the point: it
 * is what lets what the reviewer concluded and what the student complained about be counted on one axis, and a
 * failure added there can't quietly go missing here. The words shown for them differ, since the student's are
 * written in their voice and read wrong on a note of one's own.
 */
const NOTE_CATEGORIES = Object.keys(REPORT_CATEGORY_KEYS) as readonly DefenseReportCategory[]

/**
 * The most characters a note may hold, which a remark about one reply stays well inside.
 */
const MAX_CHARACTERS_PER_NOTE = 1000

/**
 * Props for the {@link AdminNoteComposer} component.
 */
type AdminNoteComposerProps = {
  /** What the note says to begin with, empty for a new one. */
  initialContent?: string
  /** Which failure it names to begin with. */
  initialCategory?: DefenseReportCategory | null
  /** Takes the note as written, reporting whether it landed. */
  onSubmit: (content: string, category: DefenseReportCategory | null) => Promise<boolean>
  /** Abandons it, when there is something to go back to. */
  onCancel?: () => void
}

/**
 * Where a note gets written: the full editor, and which failure it names.
 *
 * The categories are radio inputs dressed as chips rather than a dropdown, for a reason beyond taste: a
 * dropdown's trigger is a button, and the keys that step the queue skip typing only inside real inputs, so
 * type-ahead in a dropdown would walk the reader off the conversation they are annotating. They stand above
 * the editor because below it they would sit past the control that files the note.
 *
 * A note is typically one line about one reply, so the editor stands short and carries only the entries that
 * note needs: maths to quote the step, emphasis to mark it. Uploading a file or an image belongs to a
 * conversation, not to a remark written about one. Filing it is the editor's own footer rather than a button
 * underneath, which put the one action at the bottom of a stack of chips and read as another chip; the footer
 * also buys the same ⌘/Ctrl+Enter a comment is sent with, and the X the revision is abandoned from.
 */
export function AdminNoteComposer({
  initialContent = '',
  initialCategory = null,
  onSubmit,
  onCancel,
}: AdminNoteComposerProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // The name tying this composer's category chips into one radio group, kept off any other group on screen
  const categoryGroupName = useId()

  // The note being written
  const { content, setContent, category, setCategory, hasChanged, isSubmitting, submit } =
    useAdminNoteDraft(initialContent, initialCategory, onSubmit)

  /**
   * Swallows an Escape a new note holding something unsent would otherwise lose that note to: the key reaches
   * the dialog behind and closes the whole conversation with the text still in the box. A revision has its own
   * way out and marks the key handled before this, and an empty box has nothing to lose, so both pass through.
   *
   * @param event - The key press.
   */
  function swallowEscape(event: KeyboardEvent<HTMLDivElement>) {
    // Only the key that closes things, and only where something would go with it
    if (event.key !== 'Escape' || event.defaultPrevented || !hasChanged) return

    // Marked handled, which is what the dialog reads before closing on it
    event.preventDefault()
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={swallowEscape}>
      {/* The category chips: which failure the note names */}
      <NoteChoiceRow label={t('category')}>
        {[null, ...NOTE_CATEGORIES].map((option) => (
          <NoteChoiceChip
            key={option ?? 'none'}
            groupName={categoryGroupName}
            label={option === null ? t('categoryNone') : t(`categories.${option}`)}
            isSelected={category === option}
            onSelect={() => setCategory(option)}
          />
        ))}
      </NoteChoiceRow>

      {/* The editor the note is written and filed in */}
      <RichMathEditor
        maxCharacters={MAX_CHARACTERS_PER_NOTE}
        value={content}
        onChange={setContent}
        placeholder={t('placeholder')}
        variant="card"
        minHeightPx={96}
        toolbar={{
          image: false,
          attachment: false,
          heading: false,
          quote: false,
          spoiler: false,
          link: false,
          emoji: false,
        }}
        className="max-w-none"
        onSend={submit}
        // Whether it says anything is the editor's own to judge; this is the rest of what the note needs. One
        // already on its way is not sendable again: the box holds what it holds until the write lands, so a
        // second ⌘/Ctrl+Enter behind the first would file the same note twice
        canSend={hasChanged && !isSubmitting}
        onCancel={onCancel}
        isLoading={isSubmitting}
      />
    </div>
  )
}
