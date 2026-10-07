'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { Locale } from '@/i18n/i18n'

import { derivePhase, deriveStanding } from '../model/hosted-competition-state'
import type { HostedCompetitionGroup, PendingEntry } from '../model/hosted-competition-types'
import { CompetitionTerms, EntryAction, StandingLabel } from './HostedCompetitionGroupPanel'

/**
 * Props for the {@link PracticeBar} component.
 */
type PracticeBarProps = {
  /** The practice group. */
  group: HostedCompetitionGroup
  /** The instant its clock is read against, in epoch milliseconds. */
  now: number
  /** Whether the reader prepares competitions. */
  preparesCompetitions: boolean
  /** Opens the question that has to be answered before its clock starts. */
  onEnter: (pending: PendingEntry) => void
}

/**
 * The practice competition as one bar: its name, terms and purpose, and the way in, which never closes.
 */
export function PracticeBar({ group, now, preparesCompetitions, onEnter }: PracticeBarProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The language it is named in
  const locale = useLocale() as Locale

  // Where it sits in its own life, which is outside the calendar
  const phase = derivePhase(group, now)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-info/[0.07] px-4 py-3.5 sm:px-6">
      {/* What it is, what it asks, and what it is for */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <h2 className="font-semibold text-foreground">{group.name[locale]}</h2>
          <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            <CompetitionTerms problemCount={group.problemCount} clockMinutes={group.clockMinutes} />
          </span>
        </div>
        <p className="mt-1 text-sm text-foreground/70">{t('practiceNote')}</p>
      </div>

      {/* Where the reader stands with it, and the way in */}
      {group.competitions.map((competition) => {
        // Where they stand with this one
        const standing = deriveStanding(group, competition, now)

        return (
          <div
            key={competition.slug[locale]}
            className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm"
          >
            <StandingLabel phase={phase} standing={standing} now={now} />
            <EntryAction
              competition={competition}
              phase={phase}
              standing={standing}
              preparesCompetitions={preparesCompetitions}
              onEnter={() => onEnter({ group, competition })}
              // Never over, so nobody's results are ever kept
              onOpenResults={null}
            />
          </div>
        )
      })}
    </div>
  )
}
