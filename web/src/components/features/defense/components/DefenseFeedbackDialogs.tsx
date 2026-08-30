'use client'

import { useTranslations } from 'next-intl'

import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { entriesOf } from '@/components/shared/utils/collection-utils'

import type { AnswerFlow, ReportFlow } from '../hooks/use-defense-feedback'
import { OUTCOME_KEYS, REPORT_CATEGORY_KEYS } from '../model/defense-feedback-options'
import type { DefenseFeedback, DefenseLimits } from '../model/defense-types'
import { FeedbackDialog } from './FeedbackDialog'

/**
 * Props for the {@link DefenseFeedbackDialogs} component.
 */
type DefenseFeedbackDialogsProps = {
  /** Saying what went wrong with one of the examiner's replies. */
  report: ReportFlow
  /** Saying where the conversation as a whole left the student. */
  answer: AnswerFlow
  /** What the student has already said about the conversation; null until they say anything. */
  currentFeedback: DefenseFeedback | null
  /** The caps a comment is held to; null until the backend has said what they are. */
  limits: DefenseLimits | null
  /**
   * Whether the student is graded on the run the conversation is argued inside, which decides who reads a
   * report.
   */
  isGraded: boolean
}

/**
 * Everything a student says about a defense: what one reply got wrong, what the whole conversation did for
 * them, and the question each of those gets before it comes off again.
 *
 * They sit apart from the conversation because none of them is part of reading it: each opens over the
 * transcript, is answered, and leaves it as it was.
 */
export function DefenseFeedbackDialogs({
  report,
  answer,
  currentFeedback,
  limits,
  isGraded,
}: DefenseFeedbackDialogsProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // The answers a question offers, in the order its record lists them. The keys are the message keys the
  // defense copy is read under, so a record naming one the copy does not carry is caught here
  function optionsOf<TValue extends string>(labelKeys: Record<TValue, Parameters<typeof t>[0]>) {
    return entriesOf(labelKeys).map(([value, labelKey]) => ({ value, label: t(labelKey) }))
  }

  return (
    <>
      {/* Every way one of the examiner's replies went wrong */}
      {limits !== null && (
        <FeedbackDialog
          isOpen={report.isOpen}
          onClose={report.close}
          onRemove={report.standing === undefined ? null : report.requestRemoval}
          choice={{
            selection: 'multiple',
            initialValues: report.standing?.categories ?? [],
            onSubmit: report.submit,
          }}
          requiresComment="other"
          requiresCommentHint={t('requiresCommentHint')}
          title={t('reportTitle')}
          // In a graded run a report is read by whoever grades the transcript, and a student writing one
          // means it as a case for their solution rather than as a note about the examiner
          note={isGraded ? t('reportGradedNote') : null}
          options={optionsOf(REPORT_CATEGORY_KEYS)}
          initialComment={report.standing?.comment ?? ''}
          commentLabel={t('reportCommentLabel')}
          commentMaxLength={limits.maxFeedbackCommentChars}
          isPending={report.isSubmitting}
        />
      )}

      {/* The question before a report comes off, since taking it off drops something the student said */}
      <ConfirmDialog
        isOpen={report.isRemoving}
        onClose={report.cancelRemoval}
        onConfirm={report.confirmRemoval}
        title={t('removeReportTitle')}
        message={t('removeReportMessage')}
        variant="danger"
      />

      {/* What the student makes of the conversation as a whole */}
      {limits !== null && (
        <FeedbackDialog
          isOpen={answer.isOpen}
          onClose={answer.close}
          onRemove={currentFeedback === null ? null : answer.requestRemoval}
          choice={{
            selection: 'single',
            initialValue: currentFeedback?.outcome ?? null,
            onSubmit: answer.submit,
          }}
          requiresComment="somethingElse"
          requiresCommentHint={t('requiresCommentHint')}
          title={t('feedbackTitle')}
          note={null}
          options={optionsOf(OUTCOME_KEYS)}
          initialComment={currentFeedback?.comment ?? ''}
          commentLabel={t('feedbackCommentLabel')}
          commentMaxLength={limits.maxFeedbackCommentChars}
          isPending={answer.isSubmitting}
        />
      )}

      {/* And the same for the answer the conversation as a whole carries */}
      <ConfirmDialog
        isOpen={answer.isRemoving}
        onClose={answer.cancelRemoval}
        onConfirm={answer.confirmRemoval}
        title={t('removeFeedbackTitle')}
        message={t('removeFeedbackMessage')}
        variant="danger"
      />
    </>
  )
}
