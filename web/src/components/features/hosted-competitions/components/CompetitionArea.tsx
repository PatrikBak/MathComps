'use client'

import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { Modal } from '@/components/shared/components/Modal'
import { PRACTICE_INTRO_DISMISSED_STORAGE_KEY } from '@/constants/local-storage-constants'
import type { Locale } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'
import type { QueryUiState } from '@/lib/query-ui-state'

import { useCompetitionArea } from '../hooks/use-competition-area'
import { COMPETITIONS_LIST_HREF } from '../services/hosted-competition-routes'
import { CategoryBadge } from './CategoryBadge'
import { CompetitionProblemPanel } from './CompetitionProblemPanel'
import { CompetitionStandingStrip } from './CompetitionStandingStrip'
import { FinishEntryDialog } from './FinishEntryDialog'
import { RulesList } from './RulesList'

/**
 * Props for the {@link CompetitionArea} component.
 */
type CompetitionAreaProps = {
  /** Which competition the reader is inside. */
  competitionId: string
}

/**
 * One competition's own area: the problems, the entrant's own clock, and the conversations they hold.
 *
 * Every statement is on the page at once, the first thing an entry is spent on being deciding where the
 * clock is worth going.
 */
export function CompetitionArea({ competitionId }: CompetitionAreaProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The active locale, which decides what the group is called
  const locale = useLocale() as Locale

  // The localized router
  const router = useRouter()

  // Everything the page says about this competition and the entry spent on it
  const area = useCompetitionArea(competitionId)

  // Whether the reader has the rules open
  const [areRulesOpen, { open: openRules, close: closeRules }] = useDisclosure(false)

  // Whether the reader has been asked whether they really mean to hand the entry in
  const [isFinishAsked, { open: openFinish, close: closeFinish }] = useDisclosure(false)

  // Whether the practice run has already introduced itself to this browser
  const [isIntroDismissed, setIsIntroDismissed] = useLocalStorage<boolean>({
    key: PRACTICE_INTRO_DISMISSED_STORAGE_KEY,
    defaultValue: false,
  })

  // One of the two reads is still out, gave up, or turned up nothing to stay here for
  if (area.kind === 'pending') {
    return (
      <AreaPlaceholder
        uiState={area.uiState}
        failed={t(area.waitingOn === 'view' ? 'loadFailed' : 'areaProblemsFailed')}
      />
    )
  }

  // What there is to draw, once both reads have landed
  const {
    readerKey,
    group,
    competition,
    entry,
    problems,
    now,
    endsAt,
    isGraded,
    wasHandedIn,
    hasEnded,
    areNotesOpen,
  } = area

  return (
    // Hyphenation off: the global setting is for article prose, and the words here are names and labels
    <div className="mx-auto max-w-4xl hyphens-none">
      {/* Which competition this is, read once on the way in */}
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {group.name[locale]}
        </h1>

        {competition.category !== null && <CategoryBadge category={competition.category} />}
      </header>

      {/* Where the entry stands and what can be done about it. It comes to rest under the site header
          instead of scrolling away with the title: the statements below are long enough to put the clock
          out of sight, and a clock you have to scroll back up to read is one you stop reading */}
      <div className="sticky-below-header page-backdrop mb-6 py-2">
        <CompetitionStandingStrip
          endsAt={endsAt}
          now={now}
          wasHandedIn={wasHandedIn}
          onFinish={hasEnded || entry.kind !== 'sat' ? null : openFinish}
          onOpenRules={openRules}
          listHref={COMPETITIONS_LIST_HREF}
        />
      </div>

      {/* The terms the entry runs on, reachable for as long as it does */}
      {areRulesOpen && (
        <Modal
          isOpen
          onClose={closeRules}
          title={t('rulesButton')}
          showCloseButton
          className="max-w-xl hyphens-none"
        >
          <RulesList />
        </Modal>
      )}

      {/* What the practice run is, said once to whoever has not met it before */}
      {!isGraded && !isIntroDismissed && (
        <AreaNote>
          <p>{t('practiceIntro')}</p>

          <Button variant="link" size="sm" onClick={() => setIsIntroDismissed(true)}>
            {t('practiceIntroDismiss')}
          </Button>
        </AreaNote>
      )}

      {/* That the entry is closed, and what that does and does not stop */}
      {hasEnded && <AreaNote>{t(endedNoteKey(wasHandedIn, isGraded))}</AreaNote>}

      {/* An entry given up for the problems, which never had a clock */}
      {entry.kind === 'forfeited' && <AreaNote>{t('areaForfeited')}</AreaNote>}

      {/* The set, read top to bottom */}
      <div className="flex flex-col gap-4">
        {problems.map((problem) => (
          <CompetitionProblemPanel
            key={problem.id}
            competitionId={competitionId}
            readerKey={readerKey}
            problem={problem}
            entry={entry}
            areNotesOpen={areNotesOpen}
            isGraded={isGraded}
          />
        ))}
      </div>

      {/* What handing in costs, asked before it happens */}
      <FinishEntryDialog
        readerKey={readerKey}
        competitionId={competitionId}
        isAsked={isFinishAsked}
        hasEnded={hasEnded}
        onClose={closeFinish}
        onFinished={() => {
          // The question is answered
          closeFinish()

          // And out to the list, the way entering came in from it
          router.push(COMPETITIONS_LIST_HREF)
        }}
      />
    </div>
  )
}

/**
 * Props for the {@link AreaPlaceholder} component.
 */
type AreaPlaceholderProps = {
  /** Where the read this stands in for has got to. */
  uiState: QueryUiState
  /** What to say once it has failed. */
  failed: string
}

/**
 * What the page shows while one of its two reads is still out, and what it says when one comes back empty
 * handed. Both reads seat it the same way, so neither arrival moves the other's spinner.
 */
function AreaPlaceholder({ uiState, failed }: AreaPlaceholderProps) {
  return (
    <FetchStatePlaceholder
      uiState={uiState}
      className="flex flex-col items-center gap-3 py-16 text-center"
      empty={null}
      failed={<p className="text-sm text-muted">{failed}</p>}
    />
  )
}

/**
 * Props for the {@link AreaNote} component.
 */
type AreaNoteProps = {
  /** What the note says. */
  children: ReactNode
}

/**
 * Something the page has to tell the entrant about their entry, sat above the problems it is about.
 */
function AreaNote({ children }: AreaNoteProps) {
  return (
    <div className="mb-5 rounded-lg bg-foreground/[0.06] px-3.5 py-3 text-sm leading-relaxed text-muted">
      {children}
    </div>
  )
}

/**
 * Which sentence a closed entry gets.
 *
 * The graded pair name the results that later messages fall outside of. The practice run has none, so it
 * says what it can still offer and promises nothing.
 *
 * @param wasHandedIn - Whether the student closed it themselves rather than running out of clock.
 * @param isGraded - Whether the student is graded on this run.
 *
 * @returns The copy key.
 */
function endedNoteKey(
  wasHandedIn: boolean,
  isGraded: boolean
): 'areaFinished' | 'areaClockSpent' | 'areaFinishedPractice' | 'areaClockSpentPractice' {
  // The graded pair, which both say where the line falls
  if (isGraded) {
    return wasHandedIn ? 'areaFinished' : 'areaClockSpent'
  }

  // And the pair for a run nobody grades, counted nowhere and so mentioning no result
  return wasHandedIn ? 'areaFinishedPractice' : 'areaClockSpentPractice'
}
