'use client'

import { useTranslations } from 'next-intl'

import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { FeedbackDialog, toFeedbackOptions } from '@/components/shared/components/FeedbackDialog'

import type { AnswerFlow, ReportFlow } from '../hooks/use-defense-feedback'
import { OUTCOME_KEYS, REPORT_CATEGORY_KEYS } from '../model/defense-feedback-options'
import type { DefenseFeedback, DefenseLimits } from '../model/defense-types'

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
}: DefenseFeedbackDialogsProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

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
          options={toFeedbackOptions(REPORT_CATEGORY_KEYS, t)}
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
          options={toFeedbackOptions(OUTCOME_KEYS, t)}
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
