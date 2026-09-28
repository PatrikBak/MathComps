'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import {
  DefenseTranscript,
  type DefenseTranscriptProps,
} from '@/components/features/defense/components/DefenseTranscript'
import { ProblemStrip } from '@/components/features/defense/components/ProblemStrip'
import { MATHILDA_NAME } from '@/constants/mathilda'

/**
 * The transcript's props, less those this pane sets the same way for every admin.
 */
type AdminTranscriptProps = Omit<
  DefenseTranscriptProps,
  | 'roleLabels'
  | 'isThinking'
  | 'canGiveFeedback'
  | 'canRewind'
  | 'onRewindTurn'
  | 'onReportTurn'
  | 'showReplyNumbers'
>

/**
 * Props for the {@link TranscriptPane} component.
 */
type TranscriptPaneProps = AdminTranscriptProps & {
  /** The problem as the student saw it. */
  statement: string
  /** Whatever stands above the problem. */
  aboveStatement?: ReactNode
}

/**
 * A conversation as an admin reads it: the problem, re-readable above it, and every turn with Mathilda's
 * replies numbered, so anything written about one can name it. Nothing in it can be rewound or reported, since
 * those are the student's own.
 */
export function TranscriptPane({ statement, aboveStatement, ...transcript }: TranscriptPaneProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Whatever stands above the problem */}
      {aboveStatement}

      {/* The problem, re-readable above the conversation */}
      <ProblemStrip statement={statement} />

      {/* What was said */}
      <DefenseTranscript
        {...transcript}
        roleLabels={{ examiner: MATHILDA_NAME, candidate: t('student') }}
        isThinking={false}
        canGiveFeedback={false}
        canRewind={false}
        onRewindTurn={() => undefined}
        onReportTurn={() => undefined}
        showReplyNumbers
      />
    </div>
  )
}
