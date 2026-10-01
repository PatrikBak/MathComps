'use client'

import { ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { buttonVariants } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'

import type { SchoolYearRun } from '../model/hosted-competition-state'
import { derivePhase, roundToShow, schoolYearName } from '../model/hosted-competition-state'
import type { PendingEntry } from '../model/hosted-competition-types'
import { HostedCompetitionGroupPanel } from './HostedCompetitionGroupPanel'

/**
 * Props for the {@link HostedCompetitionSeason} component.
 */
type HostedCompetitionSeasonProps = {
  /** Every graded round, one run per school year, the newest year first. */
  years: SchoolYearRun[]
  /** The instant every clock on the page is read against, in epoch milliseconds. */
  now: number
  /** Whether the reader is let past the gates the rounds are entered through. */
  bypassesGates: boolean
  /** Opens the question that has to be answered before any clock starts. */
  onEnter: (pending: PendingEntry) => void
}

/**
 * The graded rounds of one school year as tabs, in the order they run, over the round picked in full.
 *
 * It opens on the round the reader most likely came for, and earlier school years are a menu away at the
 * end of the strip, the menu showing only once there is more than one year.
 */
export function HostedCompetitionSeason({
  years,
  now,
  bypassesGates,
  onEnter,
}: HostedCompetitionSeasonProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The language the rounds are named in
  const locale = useLocale() as Locale

  // The school year and the round the reader picked, or null while they have picked none
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const [pickedRoundId, setPickedRoundId] = useState<string | null>(null)

  // The round the board opens on, across every year
  const defaultRound = roundToShow(
    years.toReversed().flatMap((year) => year.groups),
    now
  )

  // The year showing: the one picked, else the one holding that round, else the newest
  const shownYear =
    years.find((year) => year.startYear === pickedYear) ??
    years.find((year) => defaultRound !== undefined && year.groups.includes(defaultRound)) ??
    years[0]

  // Nothing graded announced yet, so there is nothing to lay out
  if (shownYear === undefined) {
    return null
  }

  // The round showing: the one picked while it is in this year, else the one this year opens on
  const shownRoundId =
    shownYear.groups.find((group) => group.id === pickedRoundId)?.id ??
    roundToShow(shownYear.groups, now)?.id ??
    ''

  /**
   * Moves to another school year, which opens on the round it would open on by itself.
   *
   * @param startYear - The calendar year the school year starts in.
   */
  function pickYear(startYear: number) {
    // The year
    setPickedYear(startYear)

    // And no round picked inside it yet
    setPickedRoundId(null)
  }

  return (
    // Built again for each year, so the strip opens scrolled to the round showing in it
    <Tabs
      key={shownYear.startYear}
      ariaLabel={t('rounds')}
      selectedId={shownRoundId}
      onSelect={setPickedRoundId}
      items={shownYear.groups.map((group) => ({
        id: group.id,
        label: group.name[locale],
        count: null,
        isHighlighted: derivePhase(group, now) === 'open',
        panel: (
          <div className="pt-3">
            <HostedCompetitionGroupPanel
              group={group}
              now={now}
              bypassesGates={bypassesGates}
              onEnter={onEnter}
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
                  onCheckedChange={() => pickYear(year.startYear)}
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
