'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useId } from 'react'

import { describeUser } from '@/components/features/admin/model/user-identity'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { cn } from '@/components/shared/utils/css-utils'

import { useGradeComment } from '../hooks/use-grade-comment'
import { helpClickChange, markClickChange } from '../model/grade-change'
import {
  formatScore,
  type Grade,
  type GradeChange,
  MAX_MARK,
  scoreOf,
  type SelfAssessment,
} from '../model/grade-types'

/** Every mark a problem can earn, from nothing to full. */
const MARKS = Array.from({ length: MAX_MARK + 1 }, (_unused, mark) => mark)

/**
 * Props for the {@link GradePanel} component.
 */
type GradePanelProps = {
  /** The grade; null while none is given. */
  grade: Grade | null
  /** What the student said about their own solution; null when they said nothing. */
  selfAssessment: SelfAssessment | null
  /** Records a change to the grade, resolving to whether the server took it. */
  onChange: (change: GradeChange) => Promise<boolean>
}

/**
 * The grade for one student on one problem: the mark, how much of it was Mathilda's, a comment for graders, and
 * whether it is final. The mark, the help and the final flag save the moment they are clicked, and the comment
 * once the grader moves off it.
 */
export function GradePanel({ grade, selfAssessment, onChange }: GradePanelProps) {
  // Grade panel copy
  const t = useTranslations('admin.grades.panel')

  // Profile copy
  const tProfile = useTranslations('profile')

  // Dates in the reader's language
  const format = useFormatter()

  // The comment field's id
  const commentId = useId()

  // The comment, written in place and saved once the grader moves off it
  const comment = useGradeComment(grade?.internalComment ?? '', (internalComment) =>
    onChange({ internalComment })
  )

  // The mark standing; null while none is
  const mark = grade?.mark ?? null

  // The score the grade comes to; null while there is no mark
  const score = scoreOf(grade)

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
      {/* The student's self-assessment */}
      {selfAssessment !== null && (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">{t('selfAssessment')}</h3>
          <blockquote className="whitespace-pre-line rounded-md bg-foreground/5 px-3 py-2 text-sm text-foreground/90">
            {selfAssessment.comment}
          </blockquote>
        </section>
      )}

      {/* The mark */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">{t('mark')}</h3>
        <ChoiceRow
          label={t('mark')}
          options={MARKS}
          selected={mark}
          onSelect={(value) => onChange(markClickChange(grade, value))}
        />
      </section>

      {/* How much of the mark came from Mathilda */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">{t('help')}</h3>
        <p className="mb-2 text-xs text-muted">{t('helpHint')}</p>
        <ChoiceRow
          label={t('help')}
          options={MARKS.filter((value) => value <= (mark ?? 0))}
          selected={grade === null || mark === null ? null : grade.help}
          onSelect={(value) => {
            // No grade yet, so the lone 0 on offer moves nothing
            if (grade === null) return

            // What the click moves, if anything
            const change = helpClickChange(grade, value)

            // Sent only where it moves something
            if (change !== null) onChange(change)
          }}
        />
      </section>

      {/* The score */}
      <p className="text-sm text-muted">
        {t('score')}{' '}
        <span className="text-lg font-bold tabular-nums text-foreground">
          {score === null ? '–' : formatScore(score)}
        </span>{' '}
        / {MAX_MARK}
      </p>

      {/* The comment for graders */}
      <section>
        <label htmlFor={commentId} className="mb-2 block text-sm font-semibold text-foreground">
          {t('comment')}
        </label>
        <RichMathEditor
          id={commentId}
          // No limit, since the server takes a comment of any length
          maxCharacters={null}
          value={comment.draft}
          onChange={comment.setDraft}
          onBlur={comment.commit}
          placeholder={t('commentPlaceholder')}
          minHeightPx={96}
          // Formatting, math and lists only
          toolbar={{
            image: false,
            attachment: false,
            heading: false,
            quote: false,
            spoiler: false,
            link: false,
            emoji: false,
          }}
        />
      </section>

      {/* The final flag, which only a mark can carry */}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={grade?.isFinal ?? false}
          disabled={mark === null}
          onChange={(event) => onChange({ isFinal: event.target.checked })}
        />
        {t('final')}
      </label>

      {/* Who last changed the grade, and when */}
      {grade !== null && (
        <div className="mt-auto min-w-0 text-xs text-muted">
          <p className="truncate">
            {t.rich('changedBy', {
              grader: describeUser(grade.updatedBy, tProfile('defaultUser')),
              name: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
            })}
          </p>
          <p className="tabular-nums">
            {format.dateTime(new Date(grade.updatedAt), { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Props for the {@link ChoiceRow} component.
 */
type ChoiceRowProps = {
  /** The row's accessible name. */
  label: string
  /** The values on offer. */
  options: number[]
  /** The one chosen; null while none is. */
  selected: number | null
  /** Chooses a value. */
  onSelect: (value: number) => void
}

/**
 * A row of number buttons, at most one of them chosen.
 */
function ChoiceRow({ label, options, selected, onSelect }: ChoiceRowProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === selected}
          onClick={() => onSelect(value)}
          className={cn(
            'h-9 w-9 rounded-md text-sm font-semibold tabular-nums transition-colors',
            value === selected
              ? 'bg-brand/40 text-brand-foreground'
              : 'bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground'
          )}
        >
          {value}
        </button>
      ))}
    </div>
  )
}
