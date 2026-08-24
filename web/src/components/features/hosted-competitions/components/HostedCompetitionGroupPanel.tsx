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
import { useFormatter, useLocale, useTranslations } from 'next-intl'
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
import { useCompetitionAreaHref } from '../hooks/use-competition-area-href'
import { useRemainingLabel } from '../hooks/use-remaining-label'
import type { GroupPhase, HostedCompetitionStanding } from '../model/hosted-competition-state'
import { derivePhase, deriveStanding } from '../model/hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionGroup,
  PendingEntry,
} from '../model/hosted-competition-types'
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
 * A group holding a single competition has no rows, and its standing and action ride the header instead.
 */
export function HostedCompetitionGroupPanel({
  group,
  now,
  onEnter,
}: HostedCompetitionGroupPanelProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Date formatting for the reader's language
  const format = useFormatter()

  // The language the group is named in
  const locale = useLocale() as Locale

  // Wording for how long is left
  const remainingLabel = useRemainingLabel()

  // Where the group sits in its own life
  const phase = derivePhase(group, now)

  // The fortnight it takes entries in, from the first day to the last
  const windowRange =
    group.closesAt === null
      ? null
      : t('entryWindow', {
          range: format.dateTimeRange(new Date(group.opensAt), new Date(group.closesAt), {
            day: 'numeric',
            month: 'long',
          }),
        })

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

  return (
    <SurfacePanel radius="xl" className={cn('overflow-hidden', PHASE_PANEL_CLASS[phase])}>
      {/* Which group, when it runs, what holds for everything in it, and how long is left of it */}
      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            className={cn(
              'text-lg font-semibold',
              phase === 'closed' ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {group.name[locale]}
          </h2>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {renderCountdown()}

            {/* Where the student stands with the single competition, and the way into it; the header
                carries both because there is no row underneath */}
            {soleCompetition !== undefined && (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {/* When it takes entries */}
          {windowRange !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-2.5 py-1 font-medium tabular-nums text-foreground">
              <CalendarRange size={14} className="text-muted" />
              {windowRange}
            </span>
          )}
          <CompetitionTerms problemCount={group.problemCount} clockMinutes={group.clockMinutes} />
        </div>
      </div>

      {/* What the practice group is for */}
      {phase === 'practice' && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-foreground/70 sm:px-6">
          {t('practiceNote')}
        </p>
      )}

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
    // The category on the left, everything else on the right. The right-hand cluster wraps as a whole, so
    // on a narrow screen it takes its own line and stays pinned right. The row names which competition it
    // is about, a category badge being absent on the practice one and worded on the rest
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-6"
      data-competition-id={competition.id}
    >
      {/* Which category */}
      <span>
        {competition.category !== null && <CategoryBadge category={competition.category} />}
      </span>

      {/* Where the student stands, and the one way onward */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm">
        <StandingLabel competition={competition} phase={phase} standing={standing} now={now} />

        <EntryAction
          competition={competition}
          phase={phase}
          standing={standing}
          onEnter={onEnter}
        />
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
 * A group still taking entries offers one press. A group that is over offers the public results, plus
 * either the reader's own work or the problems in the archive.
 *
 * The press keeps the same word whatever stands in the way, and is never disabled: what it turns into is
 * the guard's call rather than this button's.
 *
 * The results are still being built, so that link renders dead.
 */
function EntryAction({ competition, phase, standing, onEnter }: EntryActionProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The way into the competition's own area
  const areaHref = useCompetitionAreaHref()

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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {wasInIt ? (
          <AreaLink href={areaHref(competition.id)} icon={NotebookPen} label={t('mySolutions')} />
        ) : (
          competition.problemsPublished && (
            <Button variant="link">
              <FileText size={15} />
              {t('problems')}
            </Button>
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
    // Given up for the problems, which is what is waiting for them in there
    case 'forfeited':
      return (
        <Button variant="link">
          <FileText size={15} />
          {t('problems')}
        </Button>
      )

    // Inside, and the way back to the clock they left running. The loudest thing the page can offer while
    // it is offering it: everything else here waits, and this one is being spent
    case 'running':
      return <AreaLink href={areaHref(competition.id)} icon={Play} label={t('continue')} />

    // Taken. The practice one is the only competition anybody gets a second go at; every other one offers
    // the student their own work back, which is in the area they spent the entry in
    case 'done':
      return phase === 'practice' ? (
        <Button variant="link" onClick={onEnter}>
          <RotateCcw size={15} />
          {t('tryAgain')}
        </Button>
      ) : (
        <AreaLink href={areaHref(competition.id)} icon={NotebookPen} label={t('mySolutions')} />
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
