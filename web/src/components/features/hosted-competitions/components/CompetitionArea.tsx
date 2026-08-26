'use client'

import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { Modal } from '@/components/shared/components/Modal'
import { SECOND_MS } from '@/components/shared/utils/time-units'
import { PRACTICE_INTRO_DISMISSED_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useNow } from '@/hooks/use-now'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'
import type { QueryUiState } from '@/lib/query-ui-state'

import { useCompetitionProblems } from '../hooks/use-competition-problems'
import { useEntryReader } from '../hooks/use-entry-reader'
import { useFinishHostedCompetition } from '../hooks/use-finish-hosted-competition'
import { useHostedCompetitionsView } from '../hooks/use-hosted-competitions-view'
import type { AreaEntry } from '../model/hosted-competition-state'
import { entryEndsAt, isPracticeGroup, wasHandedInEarly } from '../model/hosted-competition-state'
import { CategoryBadge } from './CategoryBadge'
import { CompetitionProblemPanel } from './CompetitionProblemPanel'
import { CompetitionStandingStrip } from './CompetitionStandingStrip'
import { RulesList } from './RulesList'

/**
 * The way back to the list. Module-level so every render hands out the same object.
 */
const LIST_HREF = { pathname: ROUTES.COMPETITIONS }

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

  // The localized router, for sending a reader with no entry back where they came from
  const router = useRouter()

  // Whose answers these are, and whether that is settled yet
  const { readerKey, isReaderKnown } = useEntryReader()

  // Whether the reader has the rules open
  const [areRulesOpen, { open: openRules, close: closeRules }] = useDisclosure(false)

  // Whether the reader has been asked whether they really mean to hand the entry in
  const [isFinishAsked, { open: openFinish, close: closeFinish }] = useDisclosure(false)

  // Closing the entry where the student says rather than where the clock does
  const { finish, isFinishing } = useFinishHostedCompetition(readerKey, competitionId, () => {
    // The question is answered
    closeFinish()

    // And out to the list, the way entering came in from it
    router.push(LIST_HREF)
  })

  // Every competition the student can see, which the board has usually already fetched
  const { view, uiState: viewState } = useHostedCompetitionsView(readerKey, isReaderKnown)

  // The group holding this competition, and the competition itself
  const competitionInGroup = view?.groups
    .flatMap((group) => group.competitions.map((competition) => ({ group, competition })))
    .find((candidate) => candidate.competition.id === competitionId)

  // The entry the reader spent on this one, which is what the problems are behind
  const entry = competitionInGroup?.competition.entry ?? null

  // Whether there is one at all
  const isEntitled = entry !== null

  // When the counted part ended, which nothing but a sat entry has
  const endsAt =
    competitionInGroup !== undefined && entry?.kind === 'sat'
      ? entryEndsAt(competitionInGroup.group, entry)
      : null

  // This competition's problems, once there is an entry to read them through
  const { problems, uiState: problemsState } = useCompetitionProblems(
    readerKey,
    competitionId,
    isEntitled
  )

  // One clock for the page, so every deadline on it moves on the same tick. An entry given up for the
  // problems has none, and neither does a page still working out what it is showing
  const now = useNow(SECOND_MS, endsAt !== null)

  // Whether the practice run has already introduced itself to this browser
  const [isIntroDismissed, setIsIntroDismissed] = useLocalStorage<boolean>({
    key: PRACTICE_INTRO_DISMISSED_STORAGE_KEY,
    defaultValue: false,
  })

  // A reader with no entry has nothing to read here, so the list is where they go instead
  useEffect(() => {
    if (view !== undefined && !isEntitled) {
      router.replace(LIST_HREF)
    }
  }, [view, isEntitled, router])

  // Still working out what there is to show, or on the way out
  if (competitionInGroup === undefined || entry === null) {
    return <AreaPlaceholder uiState={viewState} failed={t('loadFailed')} />
  }

  // And on the set itself, which is what the page is for. A page that seated its header the moment the
  // first of the two reads landed would put a spinner high on it and then move it down under the header
  // once the second one did, so both reads stand behind the same one
  if (problems === undefined) {
    return <AreaPlaceholder uiState={problemsState} failed={t('areaProblemsFailed')} />
  }

  // The group setting the terms, and the competition itself
  const { group, competition } = competitionInGroup

  // Whether this is the run nobody is graded on
  const isPractice = isPracticeGroup(group)

  // Whether the student closed it themselves, which the page says differently from a clock running out
  const wasHandedIn = entry.kind === 'sat' && wasHandedInEarly(group, entry)

  // The entry as the chat reads it: the same problems under the same terms either way, and a clock only
  // where one was ever started
  const defenseEntry: AreaEntry =
    endsAt === null ? { kind: 'forfeited' } : { kind: 'sat', endsAt, wasHandedIn }

  // Whether the counted part is over, which changes what the page says and nothing about what it offers.
  // A hand-in settles it outright, and a clock within its last second, the same boundary the reading
  // itself uses: read any finer and the two disagree for a frame
  const hasEnded = wasHandedIn || (endsAt !== null && Date.parse(endsAt) - now < SECOND_MS)

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
          listHref={LIST_HREF}
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
      {isPractice && !isIntroDismissed && (
        <AreaNote>
          <p>{t('practiceIntro')}</p>

          <Button variant="link" size="sm" onClick={() => setIsIntroDismissed(true)}>
            {t('practiceIntroDismiss')}
          </Button>
        </AreaNote>
      )}

      {/* That the entry is closed, and what that does and does not stop */}
      {hasEnded && <AreaNote>{t(endedNoteKey(wasHandedIn, isPractice))}</AreaNote>}

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
            entry={defenseEntry}
          />
        ))}
      </div>

      {/* What handing in costs, asked before it happens, there being no way back from it. The clock can run
          out while the question is still on screen, and an entry the buzzer has already closed has nothing
          left to hand in: the question goes with it, rather than leaving an irreversible press standing over
          a page which has moved on without it. A press already in flight keeps it, so the buzzer landing in
          the moment between pressing and the answer coming back does not take the spinner off the screen */}
      {isFinishAsked && (!hasEnded || isFinishing) && (
        <Modal
          isOpen
          onClose={closeFinish}
          title={t('finishDialog.title')}
          showCloseButton={false}
          className="max-w-md hyphens-none"
          // Nothing is focused ahead of the reader on a dialog whose primary button cannot be undone
          focusPanelOnOpen
        >
          <p className="text-sm leading-relaxed text-foreground/80">
            {t('finishDialog.consequence')}
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={closeFinish}>
              {t('finishDialog.keepWorking')}
            </Button>
            <Button variant="danger" loading={isFinishing} onClick={finish}>
              {t('finishDialog.confirm')}
            </Button>
          </div>
        </Modal>
      )}
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
 * @param isPractice - Whether this is the run nobody is graded on.
 *
 * @returns The copy key.
 */
function endedNoteKey(
  wasHandedIn: boolean,
  isPractice: boolean
): 'areaFinished' | 'areaClockSpent' | 'areaFinishedPractice' | 'areaClockSpentPractice' {
  // Nothing about the practice run is counted, so neither of its sentences can mention a result
  if (isPractice) {
    return wasHandedIn ? 'areaFinishedPractice' : 'areaClockSpentPractice'
  }

  // And the graded pair, which both say where the line falls
  return wasHandedIn ? 'areaFinished' : 'areaClockSpent'
}
