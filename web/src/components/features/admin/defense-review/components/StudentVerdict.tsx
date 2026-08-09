import { Flag, MessageSquareQuote } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  OUTCOME_KEYS,
  REPORT_CATEGORY_KEYS,
} from '@/components/features/defense/model/defense-feedback-options'
import type {
  DefenseFeedback,
  DefenseTurnReport,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'
import { toFeedbackOptions } from '@/components/shared/components/FeedbackDialog'

/**
 * Props for the {@link StudentVerdict} component.
 */
type StudentVerdictProps = {
  /** What the student said about the conversation as a whole; null when they said nothing. */
  feedback: DefenseFeedback | null
  /** What they hold against individual replies. */
  reports: DefenseTurnReport[]
  /** The conversation in order, which the reported replies are numbered against. */
  turns: StoredTurn[]
}

/**
 * What the student made of the conversation, read back at the end of it.
 *
 * The answers are named with the very keys the student picked from, so the reviewer reads the same words the
 * student chose rather than a second wording of them that could drift. It sits under the transcript because
 * that is where the student themself was asked, and it renders nothing when they said nothing.
 */
export function StudentVerdict({ feedback, reports, turns }: StudentVerdictProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Defense-surface copy, which is where the answers the student picked from are worded
  const tDefense = useTranslations('defense')

  // Nothing to read back
  if (feedback === null && reports.length === 0) return null

  // What each outcome is called, as the student saw it
  const outcomeLabels = new Map(
    toFeedbackOptions(OUTCOME_KEYS, tDefense).map((option) => [option.value, option.label])
  )

  // And each of the ways a reply can go wrong
  const categoryLabels = new Map(
    toFeedbackOptions(REPORT_CATEGORY_KEYS, tDefense).map((option) => [option.value, option.label])
  )

  return (
    <section className="mt-4 border-t border-foreground/10 pt-3">
      {/* Section heading */}
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        {t('studentVerdict')}
      </h3>

      {/* How the conversation left them */}
      {feedback !== null && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <MessageSquareQuote size={13} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="text-foreground">{outcomeLabels.get(feedback.outcome)}</span>
          <span className="text-muted-foreground">{feedback.comment ?? t('studentNoComment')}</span>
        </p>
      )}

      {/* And what they held against particular replies */}
      {reports.map((report) => (
        <p
          key={report.turnId}
          className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
        >
          <Flag size={13} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="text-foreground">
            {t('notes.onTurn', {
              sequence: turns.findIndex((turn) => turn.id === report.turnId) + 1,
            })}
          </span>
          <span className="text-muted-foreground">
            {report.categories.map((category) => categoryLabels.get(category)).join(', ')}
          </span>
          <span className="text-muted-foreground">{report.comment ?? t('studentNoComment')}</span>
        </p>
      ))}
    </section>
  )
}
