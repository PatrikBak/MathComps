'use client'

import { ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { useAddressedDisclosure } from '@/hooks/use-addressed-disclosure'
import type { Locale } from '@/i18n/i18n'

import { usePreloadCompetitionResults } from '../hooks/use-competition-results'
import type { SchoolYearRun } from '../model/hosted-competition-state'
import { derivePhase, roundToShow, schoolYearName } from '../model/hosted-competition-state'
import type { PendingEntry } from '../model/hosted-competition-types'
import { ROUND_PARAM } from '../services/hosted-competition-routes'
import { HostedCompetitionGroupPanel } from './HostedCompetitionGroupPanel'

/**
 * Props for the {@link HostedCompetitionSeason} component.
 */
type HostedCompetitionSeasonProps = {
  /** Every graded round, one run per school year, the newest year first. */
  years: SchoolYearRun[]
  /** The instant every clock on the page is read against, in epoch milliseconds. */
  now: number
  /** Whether the reader prepares competitions. */
  preparesCompetitions: boolean
  /** Opens the question that has to be answered before any clock starts. */
  onEnter: (pending: PendingEntry) => void
  /** Opens one competition's results, by its slug. */
  onOpenResults: (competitionSlug: string) => void
}

/**
 * The graded rounds of one school year as tabs, in the order they run, over the round picked in full.
 *
 * It opens on the round the reader most likely came for, and earlier school years are a menu away at the
 * end of the strip, the menu showing only once there is more than one year. A round the reader picks, by its
 * tab or by its year, goes on the address under {@link ROUND_PARAM}, and an address naming one opens on it.
 */
export function HostedCompetitionSeason({
  years,
  now,
  preparesCompetitions,
  onEnter,
  onOpenResults,
}: HostedCompetitionSeasonProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The language the rounds are named in
  const locale = useLocale() as Locale

  // Which round the reader picked, as the address names it
  const pickedRound = useAddressedDisclosure(ROUND_PARAM)

  // Every graded round, in the order they run
  const rounds = years.toReversed().flatMap((year) => year.groups)

  // The round showing: the one picked, else the one the board opens on
  const shownRound =
    rounds.find((group) => group.slug === pickedRound.openedValue) ?? roundToShow(rounds, now)

  // The school year holding the round showing
  const shownYear = years.find((year) => year.groups.some((group) => group === shownRound))

  // The shown round's results, read early once it has closed, so a press finds the table there
  usePreloadCompetitionResults(
    shownRound !== undefined && derivePhase(shownRound, now) === 'closed'
      ? shownRound.competitions.map((competition) => competition.slug[locale])
      : []
  )

  // Nothing graded announced yet, so there is nothing to lay out
  if (shownRound === undefined || shownYear === undefined) {
    return null
  }

  /**
   * Moves to another school year, on the round it would open on by itself.
   *
   * @param year - The school year.
   */
  function pickYear(year: SchoolYearRun) {
    // The round that year opens on
    const round = roundToShow(year.groups, now)

    // That round, picked
    if (round !== undefined) {
      pickedRound.open(round.slug)
    }
  }

  return (
    // Built again for each year, so the strip opens scrolled to the round showing in it
    <Tabs
      key={shownYear.startYear}
      ariaLabel={t('rounds')}
      selectedId={shownRound.slug}
      onSelect={pickedRound.open}
      items={shownYear.groups.map((group) => ({
        id: group.slug,
        label: group.name[locale],
        count: null,
        isHighlighted: derivePhase(group, now) === 'open',
        panel: (
          <div className="pt-3">
            <HostedCompetitionGroupPanel
              group={group}
              now={now}
              preparesCompetitions={preparesCompetitions}
              onEnter={onEnter}
              onOpenResults={onOpenResults}
            />
          </div>
        ),
      }))}
      trailing={
        years.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'gap-1 px-2 tabular-nums'
              )}
              aria-label={t('schoolYear')}
            >
              {schoolYearName(shownYear.startYear)}
              <ChevronDown size={14} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {years.map((year) => (
                <DropdownMenuCheckboxItem
                  key={year.startYear}
                  checked={year === shownYear}
                  onCheckedChange={() => pickYear(year)}
                  className="tabular-nums"
                >
                  {schoolYearName(year.startYear)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  )
}
