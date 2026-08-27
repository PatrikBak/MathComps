'use client'

import { useTranslations } from 'next-intl'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import {
  FACET_CONTROL_CLASS,
  FACET_PILL_ACTIVE_CLASS,
  FACET_PILL_CLASS,
} from '@/components/shared/components/facets/components/FacetTrigger'
import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import { cn } from '@/components/shared/utils/css-utils'

import { useDefenseReviewFacetOptions } from '../hooks/use-defense-review-facet-options'
import {
  decodeProblemKey,
  problemKeyOf,
  readSignalSelection,
  toSignalSelection,
} from '../model/defense-review-filters'
import type { DefenseReviewFilter, DefenseReviewFilterOptions } from '../model/defense-review-types'

/**
 * Props for the {@link DefenseReviewFilterBar} component.
 */
type DefenseReviewFilterBarProps = {
  /** Which conversations the queue is showing. */
  filter: DefenseReviewFilter
  /** Replaces one field of the filter. */
  onFieldChange: <TField extends keyof DefenseReviewFilter>(
    field: TField,
    value: DefenseReviewFilter[TField]
  ) => void
  /** Returns the queue to showing everything. */
  onClearAll: () => void
  /** How many fields are narrowing anything. */
  activeCount: number
  /** What the filters can be set to; null until it has been read. */
  options: DefenseReviewFilterOptions | null
}

/**
 * The row of filters over the review queue.
 *
 * Unread stands on its own rather than sitting inside a menu with the rest: it is the control this surface is
 * worked with, and burying the one thing the reader reaches for constantly behind two clicks is the wrong
 * trade even though it costs a slot in the row.
 *
 * Every facet but signals holds at most one option, and a single-select facet still hands its selection back as
 * an array, so throughout the row the pick is the last of it and an empty array is nothing picked.
 */
export function DefenseReviewFilterBar({
  filter,
  onFieldChange,
  onClearAll,
  activeCount,
  options,
}: DefenseReviewFilterBarProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // What the facets can be set to
  const {
    userOptions,
    problemOptions,
    problemGrouping,
    promptVersionOptions,
    signalOptions,
    periodOptions,
  } = useDefenseReviewFacetOptions(options)

  // Which problem option the filter currently stands on; null while it names none
  const problemKey = problemKeyOf(filter)

  // Which of the signal options the filter currently stands for
  const selectedSignals = toSignalSelection(filter)

  // Applies a signal selection to the three fields it stands for
  const applySignals = (selected: string[]) => {
    // What those options leave the three fields at
    const signals = readSignalSelection(selected, filter)

    // Each set on its own, since the facet holds them together but the filter doesn't
    onFieldChange('hasNotes', signals.hasNotes)
    onFieldChange('studentReported', signals.studentReported)
    onFieldChange('studentFeedback', signals.studentFeedback)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Unread only, dropped back out of the filter when toggled off,
          since false would ask for the read ones instead */}
      <button
        type="button"
        onClick={() => onFieldChange('unread', filter.unread === true ? undefined : true)}
        aria-pressed={filter.unread === true}
        className={cn(
          FACET_CONTROL_CLASS,
          FACET_PILL_CLASS,
          filter.unread === true && FACET_PILL_ACTIVE_CLASS
        )}
      >
        {t('filters.unread')}
      </button>

      {/* What the conversation carries, three of the filter's fields offered as one set of options */}
      <MultiSelectFacet
        variant="pill"
        title={t('filters.signals')}
        closedLabel={t('filters.any')}
        options={signalOptions}
        selected={selectedSignals}
        onChange={applySignals}
        showSearch={false}
      />

      {/* Whose conversation it is */}
      <MultiSelectFacet
        variant="pill"
        title={t('filters.user')}
        closedLabel={t('filters.any')}
        searchPlaceholder={t('filters.searchUser')}
        options={userOptions}
        selectionMode="single"
        selected={filter.userId === undefined ? [] : [filter.userId]}
        onChange={(selected) => onFieldChange('userId', selected.at(-1))}
      />

      {/* Which problem it was held against */}
      <MultiSelectFacet
        variant="pill"
        title={t('filters.problem')}
        closedLabel={t('filters.any')}
        searchPlaceholder={t('filters.searchProblem')}
        options={problemOptions}
        grouping={problemGrouping}
        selectionMode="single"
        selected={problemKey === null ? [] : [problemKey]}
        onChange={(selected) => {
          // Which problem now stands, if any
          const picked = selected.at(-1)

          // Which fields it narrows by, an archive problem and a handout one taking different ones
          const fields = picked === undefined ? null : decodeProblemKey(picked)

          // Every field set from the one pick, so picking a problem of one kind clears the other's
          onFieldChange('handoutContentId', fields?.handoutContentId)
          onFieldChange('environmentId', fields?.environmentId)
          onFieldChange('problemSlug', fields?.problemSlug)
        }}
      />

      {/* How recently it moved */}
      <MultiSelectFacet
        variant="pill"
        title={t('filters.period')}
        closedLabel={t('filters.any')}
        options={periodOptions}
        selectionMode="single"
        selected={filter.withinDays === undefined ? [] : [String(filter.withinDays)]}
        onChange={(selected) => {
          // How far back the reader now looks, if at all
          const picked = selected.at(-1)

          // The options are keyed by the day count itself, so the id is the value
          onFieldChange('withinDays', picked === undefined ? undefined : Number(picked))
        }}
        showSearch={false}
      />

      {/* Which examiner settings it ran on */}
      <MultiSelectFacet
        variant="pill"
        title={t('filters.promptVersion')}
        closedLabel={t('filters.any')}
        options={promptVersionOptions}
        selectionMode="single"
        selected={filter.promptVersion === undefined ? [] : [filter.promptVersion]}
        onChange={(selected) => onFieldChange('promptVersion', selected.at(-1))}
        showSearch={false}
      />

      {/* The way back to showing everything, offered only once something is narrowing */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground',
            FOCUS_RING_CLASS
          )}
        >
          {t('clearFilters')}
        </button>
      )}
    </div>
  )
}
