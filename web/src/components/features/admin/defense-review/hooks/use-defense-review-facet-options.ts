import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { buildEnvironmentLabels } from '@/components/features/handouts/handout-utils'
import type { FacetOption } from '@/components/shared/components/facets/model/facet-types'
import type { Locale } from '@/i18n/i18n'

import {
  toProblemFacet,
  toPromptVersionFacetOptions,
  toUserFacetOptions,
} from '../model/defense-review-facet-options'
import type { DefenseReviewFilterOptions } from '../model/defense-review-types'

/**
 * How many days each of the period options covers. A day and a year are the ends a reader actually asks for;
 * everything between them is there so no filter has to be approximated by the option next to it.
 */
const PERIOD_DAYS = [1, 7, 14, 30, 90, 365]

/**
 * How a problem's options are sectioned, one section per handout.
 */
type ProblemGrouping = {
  /** The handouts holding the problems, as their content ids. */
  keys: string[]
  /** What to call each of them, by content id. */
  labels: Record<string, string>
}

/**
 * What {@link useDefenseReviewFacetOptions} hands back.
 */
type UseDefenseReviewFacetOptionsResult = {
  /** The students who have held a conversation. */
  userOptions: FacetOption[]
  /** The problems one has been held against. */
  problemOptions: FacetOption[]
  /** The handouts those problems sit under. */
  problemGrouping: ProblemGrouping
  /** The examiner settings the conversations ran on. */
  promptVersionOptions: FacetOption[]
  /** What the student left behind. */
  signalOptions: FacetOption[]
  /** How long ago a conversation may have last moved. */
  periodOptions: FacetOption[]
}

/**
 * Turns what the queue's filters can be set to into the options its facets show.
 *
 * The backend can only count these; naming them takes handout content, the reader's language, and their locale's
 * way of writing a date, none of which it has. So the labelling happens here, against what the facets want.
 *
 * @param options - What the filters can be set to; null until it has been read.
 * @returns The options as described by {@link UseDefenseReviewFacetOptionsResult}.
 */
export function useDefenseReviewFacetOptions(
  options: DefenseReviewFilterOptions | null
): UseDefenseReviewFacetOptionsResult {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Handout-surface copy
  const tHandouts = useTranslations('handouts')

  // Profile copy
  const tProfile = useTranslations('profile')

  // The active locale
  const locale = useLocale() as Locale

  // Locale-aware value formatter
  const format = useFormatter()

  // How to name a problem
  const labeller = useMemo(
    () => ({
      environmentLabels: buildEnvironmentLabels(tHandouts),
      deletedHandoutLabel: t('deletedHandout'),
      locale,
    }),
    [tHandouts, t, locale]
  )

  // The students who have held a conversation
  const userOptions = useMemo(
    () => (options === null ? [] : toUserFacetOptions(options.users, tProfile('defaultUser'))),
    [options, tProfile]
  )

  // The problems one has been held against, under the handout they belong to, with what to call each of
  // those handouts; held still so that redrawing the row doesn't reopen a section the reader collapsed
  // while searching
  const problemFacet = useMemo(
    () =>
      options === null
        ? { options: [], sectionLabels: {} }
        : toProblemFacet(options.problems, labeller),
    [options, labeller]
  )

  // The options themselves
  const problemOptions = problemFacet.options

  // The sections in the order the handouts came, and what each is called
  const problemGrouping = useMemo(
    () => ({ keys: Object.keys(problemFacet.sectionLabels), labels: problemFacet.sectionLabels }),
    [problemFacet]
  )

  // The settings the conversations ran on
  const promptVersionOptions = useMemo(
    () =>
      options === null
        ? []
        : toPromptVersionFacetOptions(options.promptVersions, (isoDate) =>
            format.dateTime(new Date(isoDate), { dateStyle: 'short', timeStyle: 'short' })
          ),
    [options, format]
  )

  // What the student left behind
  const signalOptions = useMemo(
    () => [
      { id: 'hasNotes', displayName: t('filters.signalsHasNotes') },
      { id: 'noNotes', displayName: t('filters.signalsNoNotes') },
      { id: 'reported', displayName: t('filters.signalsReported') },
      { id: 'feedback', displayName: t('filters.signalsFeedback') },
    ],
    [t]
  )

  // How long ago a conversation may have last moved
  const periodOptions = useMemo(
    () =>
      PERIOD_DAYS.map((days) => ({
        id: String(days),
        displayName: t('filters.periodDays', { days }),
      })),
    [t]
  )

  // Every filter's options, named the way a reader would recognise them
  return {
    userOptions,
    problemOptions,
    problemGrouping,
    promptVersionOptions,
    signalOptions,
    periodOptions,
  }
}
