'use client'

import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  CalendarRange,
  FileText,
  NotebookPen,
  Play,
  RotateCcw,
  Timer,
  Trophy,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { Button } from '@/components/shared/components/Button'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { formatClockRemaining } from '@/components/shared/utils/duration-utils'
import type { Locale } from '@/i18n/i18n'

import { useClockLength } from '../hooks/use-clock-length'
import { useEntryWindowLabel } from '../hooks/use-entry-window-label'
import { useRemainingLabel } from '../hooks/use-remaining-label'
import type { GroupPhase, HostedCompetitionStanding } from '../model/hosted-competition-state'
import { derivePhase, deriveStanding } from '../model/hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionGroup,
  PendingEntry,
} from '../model/hosted-competition-types'
import { competitionAreaHref } from '../services/hosted-competition-routes'
import { CategoryBadge } from './CategoryBadge'

/**
 * How each phase tints its panel. Only the group taking entries and the practice one are tinted.
 */
const PHASE_PANEL_CLASS: Record<GroupPhase, string> = {
  practice: 'border-info/25 bg-info/5',
  upcoming: '',
  open: 'border-brand/30 bg-brand/5',
  closed: '',
}

/**
 * Props for the {@link HostedCompetitionGroupPanel} component.
 */
type HostedCompetitionGroupPanelProps = {
  /** The group, and the competitions that open and close with it. */
  group: HostedCompetitionGroup
  /** The instant every clock on the page is read against, in epoch milliseconds. */
  now: number
  /** Opens the question that has to be answered before any clock starts. */
  onEnter: (pending: PendingEntry) => void
}

/**
 * One group of the program: when it runs, and the competitions running inside it.
 *
 * The header carries everything the group's competitions share: its name, the entry window, the problem
 * count and the clock. Each row under it carries one competition's category, standing and action.
 *
 * A group holding a single competition has no rows, and its standing and action take a line of their own
 * under the header.
 */
export function HostedCompetitionGroupPanel({
  group,
  now,
  onEnter,
}: HostedCompetitionGroupPanelProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The language the group is named in
  const locale = useLocale() as Locale

  // Wording for how long is left
  const remainingLabel = useRemainingLabel()

  // Wording for the window a group takes entries in
  const entryWindowLabel = useEntryWindowLabel()

  // Where the group sits in its own life
  const phase = derivePhase(group, now)

  // The fortnight it takes entries in, from the first day to the last
  const entryWindow = entryWindowLabel(group.opensAt, group.closesAt)

  // The one competition a group can hold instead of one per category, whose standing and action then ride
  // the header
  const soleCompetition = group.competitions.length === 1 ? group.competitions[0] : undefined

  /**
   * Draws how long is left of whatever the group is currently doing.
   *
   * @returns The countdown, or null for a group with no dates.
   */
  function renderCountdown(): ReactNode {
    switch (phase) {
      // Never opened on a date and never closes on one
      case 'practice':
        return null

      // Announced, so the wait is until it opens
      case 'upcoming':
        return (
          <span className="text-muted-foreground">
            {t('opensIn', { remaining: remainingLabel(group.opensAt, now) })}
          </span>
        )

      // Taking entries, with the window running out
      case 'open':
        return group.closesAt === null ? null : (
          <span className="font-medium text-brand-light">
            {t('closesIn', { remaining: remainingLabel(group.closesAt, now) })}
          </span>
        )

      // Over, with nothing left to count down to
      case 'closed':
        return <span className="text-muted/80">{t('closedLabel')}</span>

      // Every phase is handled above
      default:
        return assertNever(phase)
    }
  }

  // How long is left, where the group has anything left to count
  const countdown = renderCountdown()

  return (
    <SurfacePanel radius="xl" className={cn('overflow-hidden', PHASE_PANEL_CLASS[phase])}>
      {/* Which group, when it runs, how long is left of it, and what holds for everything inside it */}
      <div className="px-4 py-4 sm:px-6">
        {/* The countdown holds the top right corner whatever the name's length, which a long name
            wraps as text underneath */}
        <div className="flex items-baseline justify-between gap-x-4">
          <h2
            className={cn(
              'min-w-0 text-pretty text-lg font-semibold',
              phase === 'closed' ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {group.name[locale]}
          </h2>

          {countdown !== null && <div className="shrink-0 text-sm">{countdown}</div>}
        </div>

        <div className="mt-3 flex flex-col items-start gap-2 text-sm sm:mt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          {/* When it takes entries */}
          {entryWindow !== null && (
            <span className="inline-flex items-start gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1 font-medium tabular-nums text-foreground">
              {/* 3px is where centring puts a 14px icon on a 20px line, so it keeps that spot on the
                  first line once the range wraps */}
              <CalendarRange size={14} className="mt-[3px] shrink-0 text-muted" aria-hidden />
              {/* Names what the dates are for, which the icon does visually */}
              <span className="sr-only">{t('entryWindowLabel')}</span>
              {/* One box for the whole range: as separate children of the chip's flex the parts lay out
                  in a row that never wraps */}
              <span className="min-w-0">
                <span className="whitespace-nowrap">{entryWindow.opens}</span>{' '}
                <span className="mx-0.5 text-muted">&ndash;</span>{' '}
                <span className="whitespace-nowrap">{entryWindow.closes}</span>
              </span>
            </span>
          )}

          {/* What it asks of whoever takes it, kept in a box of their own so a narrow screen breaks
              before the pair rather than between them */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CompetitionTerms problemCount={group.problemCount} clockMinutes={group.clockMinutes} />
          </div>
        </div>

        {/* What the practice group is for */}
        {phase === 'practice' && (
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">{t('practiceNote')}</p>
        )}

        {/* Where the student stands with the single competition, and the way into it. It takes the line a
            row would have given it, so both shapes of card put the action in the same place. Several
            states leave both of them with nothing to say, and an empty line still carries its margin */}
        {soleCompetition !== undefined && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm empty:hidden sm:gap-x-5">
            <StandingLabel
              competition={soleCompetition}
              phase={phase}
              standing={deriveStanding(group, soleCompetition, now)}
              now={now}
            />

            <EntryAction
              competition={soleCompetition}
              phase={phase}
              standing={deriveStanding(group, soleCompetition, now)}
              onEnter={() => onEnter({ group, competition: soleCompetition })}
            />
          </div>
        )}
      </div>

      {/* And the competitions themselves, one per category */}
      {soleCompetition === undefined && (
        <div className="divide-y divide-foreground/10 border-t border-foreground/10">
          {group.competitions.map((competition) => (
            <CompetitionRow
              key={competition.id}
              group={group}
              competition={competition}
              phase={phase}
              now={now}
              onEnter={() => onEnter({ group, competition })}
            />
          ))}
        </div>
      )}
    </SurfacePanel>
  )
}

/**
 * Props for the {@link CompetitionRow} component.
 */
type CompetitionRowProps = {
  /** The group it belongs to, whose clock the entry runs on. */
  group: HostedCompetitionGroup
  /** The competition this row is about. */
  competition: HostedCompetition
  /** Where its group sits in its own life. */
  phase: GroupPhase
  /** The instant its clock is read against, in epoch milliseconds. */
  now: number
  /** Opens the question that has to be answered before the clock starts. */
  onEnter: () => void
}

/**
 * One competition: one category, where the student stands with it, and the one thing they can do about it.
 */
function CompetitionRow({ group, competition, phase, now, onEnter }: CompetitionRowProps) {
  // Where the student stands with it
  const standing = deriveStanding(group, competition, now)

  return (
    // The category on the left and the way onward pinned right, at every width. On a narrow screen the
    // standing drops to a line of its own beneath them, so every row's action sits at the same end of
    // the same line; on a wider one the two re-form as the single right-hand cluster. The row names which
    // competition it is about, a category badge being absent on the practice one and worded on the rest
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-sm sm:px-6"
      data-competition-id={competition.id}
    >
      {/* Which category */}
      <span>
        {competition.category !== null && <CategoryBadge category={competition.category} />}
      </span>

      {/* No box of its own on a narrow screen: it hands its two children straight to the row, which is
          what lets them take separate lines there and one cluster here */}
      <div className="contents sm:ml-auto sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-5">
        {/* Where the student stands, which several states leave nothing to say */}
        <div className="order-2 w-full text-right empty:hidden sm:order-none sm:w-auto">
          <StandingLabel competition={competition} phase={phase} standing={standing} now={now} />
        </div>

        {/* And the one way onward */}
        <div className="order-1 ml-auto empty:hidden sm:order-none sm:ml-0">
          <EntryAction
            competition={competition}
            phase={phase}
            standing={standing}
            onEnter={onEnter}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Props for the {@link StandingLabel} component.
 */
type StandingLabelProps = {
  /** The competition being stood in. */
  competition: HostedCompetition
  /** Where its group sits in its own life. */
  phase: GroupPhase
  /** Where the student stands with it. */
  standing: HostedCompetitionStanding
  /** The instant its clock is read against, in epoch milliseconds. */
  now: number
}

/**
 * Where the student stands with one competition, said only when the row's action does not already say it:
 * a clock still running, and marks that have not landed.
 *
 * Its own component because a group holding a single competition has no row and still has a standing.
 */
function StandingLabel({ competition, phase, standing, now }: StandingLabelProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Say the one thing this standing leaves worth saying
  switch (standing.kind) {
    // Never taken, so there is nothing to say
    case 'none':
      return null

    // Inside, with the clock the whole entry is measured by still running
    case 'running':
      return (
        <span className="font-semibold tabular-nums text-brand-light">
          {t('standing.running', {
            clock: formatClockRemaining(Date.parse(standing.endsAt) - now),
          })}
        </span>
      )

    // Given up for the problems, which the action beside it already says
    case 'forfeited':
      return null

    // Over, so the only thing left to say is that the marks have not landed yet
    case 'done':
      return phase === 'closed' && !competition.resultsPublished ? (
        <span className="text-muted/80">{t('resultsPending')}</span>
      ) : null

    // Every standing is handled above
    default:
      return assertNever(standing)
  }
}

/**
 * Props for the {@link CompetitionTerms} component.
 */
type CompetitionTermsProps = {
  /** How many problems the set holds. */
  problemCount: number
  /** How long the student's own clock runs, in minutes. */
  clockMinutes: number
}

/**
 * What a competition asks of whoever takes it: how many problems, and how long they get.
 *
 * Two facts rather than one string, each behind the icon its own kind carries elsewhere on the page.
 */
function CompetitionTerms({ problemCount, clockMinutes }: CompetitionTermsProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Wording for how long a clock runs
  const clockLength = useClockLength()

  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-muted">
        <FileText size={14} />
        {t('problemCount', { count: problemCount })}
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Timer size={14} />
        {clockLength(clockMinutes)}
      </span>
    </>
  )
}

/**
 * Props for the {@link AreaLink} component.
 */
type AreaLinkProps = {
  /** Where it goes. */
  href: ComponentProps<typeof AppLink>['href']
  /** What it is drawn with. */
  icon: LucideIcon
  /** What it says. */
  label: string
}

/**
 * A way into a competition's own area, worded the way the presses beside it are.
 */
function AreaLink({ href, icon: Icon, label }: AreaLinkProps) {
  return (
    <AppLink href={href} plain className="text-link">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <Icon size={15} />
        {label}
      </span>
    </AppLink>
  )
}

/**
 * Props for the {@link EntryAction} component.
 */
type EntryActionProps = {
  /** The competition being acted on. */
  competition: HostedCompetition
  /** Where its group sits in its own life. */
  phase: GroupPhase
  /** Where the student stands with it. */
  standing: HostedCompetitionStanding
  /** Takes the press on the way in. */
  onEnter: () => void
}

/**
 * The one thing a student can do with one competition, whichever of its lives it is currently in.
 *
 * A group still taking entries offers one press. A group that is over offers the public results, plus the
 * same area: the reader's own work where they were in it, and, once the problems are public, the set with
 * its official solutions where they were not.
 *
 * The press keeps the same word whatever stands in the way, and is never disabled: what it turns into is
 * the guard's call rather than this button's.
 *
 * The results are still being built, so that link renders dead.
 */
function EntryAction({ competition, phase, standing, onEnter }: EntryActionProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Over, so the way in is gone and both of the things it left behind are open to everybody. They are its
  // own, not its group's: each category was a different problem set answered by a different set of people.
  // A clock still running outlives the window, an entry ending on its own length
  if (phase === 'closed' && standing.kind !== 'running') {
    // Both of the things a closed competition leaves behind, open to everybody: the reader's own work
    // where they were in it and the problems where they were not, then the public results. The results go
    // last because every row has them, and the group is right-aligned, so only its final item sits at a
    // fixed place

    // Whether the reader was in this one
    const wasInIt = standing.kind !== 'none'

    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5">
        {wasInIt ? (
          <AreaLink
            href={competitionAreaHref(competition.id)}
            icon={NotebookPen}
            label={t('mySolutions')}
          />
        ) : (
          competition.problemsPublished && (
            <AreaLink
              href={competitionAreaHref(competition.id)}
              icon={FileText}
              label={t('problems')}
            />
          )
        )}

        {competition.resultsPublished && (
          <Button variant="link">
            <Trophy size={15} />
            {t('results')}
          </Button>
        )}
      </div>
    )
  }

  // Whatever the standing leaves them to press
  switch (standing.kind) {
    // Given up for the problems, which is what is waiting for them in there, with the solutions beside
    // them: giving the entry up is saying they are not competing here
    case 'forfeited':
      return (
        <AreaLink
          href={competitionAreaHref(competition.id)}
          icon={FileText}
          label={t('problems')}
        />
      )

    // Inside, and the way back to the clock they left running. The loudest thing the page can offer while
    // it is offering it: everything else here waits, and this one is being spent
    case 'running':
      return (
        <AreaLink href={competitionAreaHref(competition.id)} icon={Play} label={t('continue')} />
      )

    // Taken, so what the entry bought is back in the area it was spent in: their own work, and the
    // solutions the end of a run opens. The practice one is the only competition anybody gets a second go
    // at, and that offer comes second: taking it again starts a new clock, which closes the solutions the
    // last run just opened
    case 'done':
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5">
          <AreaLink
            href={competitionAreaHref(competition.id)}
            icon={NotebookPen}
            label={t('mySolutions')}
          />

          {phase === 'practice' && (
            <Button variant="link" onClick={onEnter}>
              <RotateCcw size={15} />
              {t('tryAgain')}
            </Button>
          )}
        </div>
      )

    // Untaken, so the group decides: one that has not opened yet has nothing to press, and an open one
    // offers the way in
    case 'none':
      return phase === 'upcoming' ? null : (
        <Button variant="link" onClick={onEnter}>
          <ArrowRight size={15} />
          {phase === 'practice' ? t('try') : t('enter')}
        </Button>
      )

    // Every standing is handled above
    default:
      return assertNever(standing)
  }
}
