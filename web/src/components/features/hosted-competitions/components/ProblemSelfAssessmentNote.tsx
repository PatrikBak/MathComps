'use client'

import { MessageSquareQuote } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'

import { Button } from '@/components/shared/components/Button'

import type { HostedCompetitionsReaderKey } from '../hooks/hosted-competition-cache'
import { useProblemSelfAssessment } from '../hooks/use-problem-self-assessment'

/**
 * Props for the {@link ProblemSelfAssessmentNote} component.
 */
type ProblemSelfAssessmentNoteProps = {
  /** Who the cached set this writes into belongs to. */
  readerKey: HostedCompetitionsReaderKey
  /** Which competition the problem belongs to. */
  competitionId: string
  /** Which problem the note is about. */
  problemId: string
  /** What the student has already left, or null while they have left nothing. */
  assessment: string | null
  /** Whether the note can still be written, which closes shortly after the entry does. */
  areNotesOpen: boolean
  /** Whether the student is graded on this run, which changes who the note says will read it. */
  isGraded: boolean
  /** The longest the note may be, which the backend refuses anything over. */
  maxCommentChars: number
}

/**
 * A note the student can leave about their own solution to one problem, asked on the problem rather than in
 * any one conversation: they hold one view of the solution however many times they argued it.
 *
 * Open the whole time the entry runs and for the grace after it ends, which the server sets.
 */
export function ProblemSelfAssessmentNote({
  readerKey,
  competitionId,
  problemId,
  assessment,
  areNotesOpen,
  isGraded,
  maxCommentChars,
}: ProblemSelfAssessmentNoteProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // The note, and the writes that put it on the record
  const note = useProblemSelfAssessment(readerKey, competitionId, problemId, assessment)

  // A stem for the field's own ids, so several problems' notes can't share one
  const fieldId = useId()

  // Closed, so what was left is there to re-read and nothing more
  if (!areNotesOpen) {
    return assessment === null ? null : (
      <p className="mt-1 px-3 py-2 text-sm text-muted">
        <NoteWords>{assessment}</NoteWords>
      </p>
    )
  }

  // Being written, which is the field and what to do with it
  if (note.isOpen) {
    return (
      <div className="mt-2">
        {/* The ask, above the field */}
        <label htmlFor={fieldId} className="mb-1.5 block text-sm text-muted">
          {t('selfAssessmentPrompt')}
        </label>

        {/* Capped where the server caps it, so a note is stopped as it is written and not once it is
            finished. Not resizable: dragging it taller would push the rest of the set around */}
        <textarea
          id={fieldId}
          value={note.draft}
          onChange={(event) => note.setDraft(event.target.value)}
          maxLength={maxCommentChars}
          rows={3}
          className="form-input resize-none"
          autoFocus
        />

        {/* Who ends up reading it, which a run nobody grades answers differently */}
        <p className="mt-1.5 text-xs text-muted">
          {t(isGraded ? 'selfAssessmentNote' : 'selfAssessmentPracticeNote')}
        </p>

        <div className="mt-2 flex items-center justify-end gap-2">
          {/* Offered only where there is something to take back, and pushed away from the pair on the
              right so dropping the note is never the button beside the one that keeps it. */}
          {note.remove !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={note.remove}
              className="mr-auto hover:bg-error/10 hover:text-error"
            >
              {tActions('remove')}
            </Button>
          )}

          {/* Leaves what already stands where it is: closing is not the same as taking it back */}
          <Button variant="ghost" size="sm" onClick={note.close}>
            {tActions('cancel')}
          </Button>

          {/* Dead until the words say something the record doesn't already say */}
          <Button
            variant="primary"
            size="sm"
            onClick={note.save}
            disabled={!note.canSave}
            loading={note.isSaving}
          >
            {tActions('save')}
          </Button>
        </div>
      </div>
    )
  }

  // Closed, which is either what was left or the invitation to leave something
  return assessment === null ? (
    // Nothing said yet, so the invitation to say something
    <Button
      variant="outline"
      size="sm"
      shape="pill"
      onClick={note.open}
      className="mt-3 min-h-0 gap-2 self-start px-3 py-1 text-muted-foreground hover:text-foreground"
    >
      <MessageSquareQuote size={15} className="shrink-0" />
      {t('selfAssessmentAsk')}
    </Button>
  ) : (
    // Something already said, shown as the words themselves and opening the note back up when pressed.
    // Not the shared Button, whose every variant carries a fill or an edge that would box the sentence
    <button
      type="button"
      onClick={note.open}
      className="focus mt-1 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-foreground/5 hover:text-foreground"
    >
      <NoteWords>{assessment}</NoteWords>
    </button>
  )
}

/**
 * Props for the {@link NoteWords} component.
 */
type NoteWordsProps = {
  /** The words the student left. */
  children: string
}

/**
 * What the student left, under the same mark the ask carries, so the words read as theirs wherever they
 * sit.
 */
function NoteWords({ children }: NoteWordsProps) {
  return (
    <span className="flex items-start gap-2">
      {/* Nudged onto the first line's baseline, since the words below it can run to several */}
      <MessageSquareQuote size={15} className="mt-0.5 shrink-0 text-muted" />
      {children}
    </span>
  )
}
