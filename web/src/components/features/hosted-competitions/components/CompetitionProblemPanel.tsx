'use client'

import { useDisclosure } from '@mantine/hooks'
import { MessageSquare, Plus } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { DefenseConversation } from '@/components/features/defense/components/DefenseConversation'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { MATHILDA_NAME } from '@/constants/mathilda'
import type { Locale } from '@/i18n/i18n'

import type { HostedCompetitionsReaderKey } from '../hooks/hosted-competition-cache'
import type { AreaRun } from '../model/hosted-competition-state'
import type { HostedCompetitionProblem } from '../model/hosted-competition-types'
import { CompetitionSolution } from './CompetitionSolution'
import { ProblemSelfAssessmentNote } from './ProblemSelfAssessmentNote'

/**
 * Props for the {@link CompetitionProblemPanel}.
 */
type CompetitionProblemPanelProps = {
  /** Which competition sets the problem. */
  competitionId: string
  /** Whose entry it is being solved under. */
  readerKey: HostedCompetitionsReaderKey
  /** The problem, and the conversations held about it. */
  problem: HostedCompetitionProblem
  /** The run it is being solved inside, or null on a closed competition the reader was never in. */
  run: AreaRun | null
  /** Whether the student is graded on this run. */
  isGraded: boolean
}

/**
 * One problem of a competition's set: its statement, and every conversation the entrant has held about it.
 */
export function CompetitionProblemPanel({
  competitionId,
  readerKey,
  problem,
  run,
  isGraded,
}: CompetitionProblemPanelProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The active locale, which decides which language the statement is read in
  const locale = useLocale() as Locale

  // Dates and times, worded for the reader
  const format = useFormatter()

  // Which conversation the chat is open on, or null to open on a fresh one
  const [openedSessionId, setOpenedSessionId] = useState<string | null>(null)

  // Whether the chat is open at all
  const [isOpen, { open, close }] = useDisclosure(false)

  // Opens the chat on one conversation, or on a fresh one when none is named
  const openDefense = (sessionId: string | null) => {
    setOpenedSessionId(sessionId)
    open()
  }

  return (
    <SurfacePanel as="article" radius="xl" className="p-4 sm:p-6">
      {/* Which of the set this is */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {t('problemHeading', { position: problem.position })}
      </h2>

      {/* The problem itself */}
      <div className="math-typography mb-4">
        <RichMathEditorRenderer content={problem.statement[locale]} lightImageBackground={false} />
      </div>

      {/* The solution and every conversation held about the problem, the oldest conversation last. Pulled
          out by the row padding, so that what a row says starts on the same left edge as the statement
          above it rather than inside it */}
      <div className="-mx-3 flex flex-col gap-0.5">
        {/* How it was meant to go, once the student is no longer competing for it */}
        {problem.solution !== null && (
          <CompetitionSolution
            position={problem.position}
            statement={problem.statement}
            solution={problem.solution}
          />
        )}

        {problem.defenses.map((defense) => (
          <button
            key={defense.sessionId}
            type="button"
            onClick={() => openDefense(defense.sessionId)}
            data-defense-session-id={defense.sessionId}
            className="focus flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5"
          >
            {/* When the student opened it */}
            <span className="inline-flex items-center gap-2 text-foreground">
              <MessageSquare size={15} className="text-muted" />
              {format.dateTime(new Date(defense.startedAt), {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          </button>
        ))}

        {/* One more conversation about the same problem */}
        <Button
          variant="link"
          size="sm"
          className="mt-1 ml-3 self-start"
          onClick={() => openDefense(null)}
        >
          <Plus size={15} />
          {problem.defenses.length === 0 ? t('startDefense') : t('startAnotherDefense')}
        </Button>

        {/* What the student wants to say about their own solution, which is about the problem rather than
            about any one of the conversations above it */}
        <ProblemSelfAssessmentNote
          readerKey={readerKey}
          competitionId={competitionId}
          problemId={problem.id}
          assessment={problem.selfAssessment}
          areNotesOpen={run?.kind === 'sat' && run.areNotesOpen}
          isGraded={isGraded}
          maxCommentChars={problem.maxCommentChars}
        />
      </div>

      {/* The chat itself, keyed on the opening so resuming a different conversation remounts it */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={close}
          showCloseButton={false}
          padded={false}
          ariaLabel={MATHILDA_NAME}
          tall
        >
          <DefenseConversation
            key={openedSessionId ?? 'fresh'}
            problem={{
              target: { kind: 'competition', competitionId, problemId: problem.id, readerKey },
              statement: problem.statement[locale],
            }}
            isOpen={isOpen}
            onClose={close}
            opening={
              openedSessionId === null
                ? { kind: 'fresh' }
                : { kind: 'named', sessionId: openedSessionId }
            }
            // Nothing of the reader's own is being spent on a competition they never entered, so the
            // conversation is held on the same terms any other problem's is
            competition={run === null ? null : { entry: run, isGraded }}
          />
        </Modal>
      )}
    </SurfacePanel>
  )
}
