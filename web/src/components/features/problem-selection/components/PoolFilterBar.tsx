'use client'

import { useTranslations } from 'next-intl'

import {
  FacetClearButton,
  FacetTogglePill,
} from '@/components/shared/components/facets/components/FacetBarControls'
import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import type { FacetSelectionMode } from '@/components/shared/components/facets/model/facet-types'

import { useAreaName } from '../hooks/use-area-name'
import type { UsePoolFiltersResult } from '../hooks/use-pool-filters'
import { useRecommendationTargetName } from '../hooks/use-recommendation-target-name'
import {
  countActiveFilters,
  filterForView,
  OFFERED_STANDINGS,
  type PoolStanding,
} from '../model/pool-filter'
import type { PoolCounts } from '../model/pool-matches'
import { recommendationTargetsOf, targetKeyOf } from '../model/recommendation-targets'
import type { PoolViewMode } from '../model/selection-routes'
import { PROPOSAL_AREAS } from '../model/selection-types'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link PoolFilterBar} component.
 */
type PoolFilterBarProps = {
  /** The layout of the pool the filters narrow. */
  mode: PoolViewMode
  /** What the pool is narrowed to, and the ways of changing it. */
  filters: UsePoolFiltersResult
  /** How much of what the layout lists stands beside each option; null until it arrives. */
  counts: PoolCounts | null
}

/**
 * The row of filters over a layout of the pool: a pill dropdown per facet whose options carry their counts, and a pill
 * for the set-aside problems. The State facet offers what the layout offers, and a pick it doesn't offer reads as none.
 */
export function PoolFilterBar({ mode, filters, counts }: PoolFilterBarProps) {
  // Filter copy
  const t = useTranslations('problemSelection.filters')

  // The selection; null until its read lands
  const { selection } = useSelectionWorkspace()

  // What a problem can be recommended for, in the order it runs; none until the selection's read lands
  const targets =
    selection === null ? [] : recommendationTargetsOf(selection.categories, selection.boards)

  // What each recommendation target is called
  const targetName = useRecommendationTargetName()

  // What each area is called
  const areaName = useAreaName()

  // What each answer on the State facet is called
  const standingNames: Record<PoolStanding, string> = {
    selected: t('selected'),
    notSelected: t('notSelected'),
    wholePaper: t('wholePaper'),
  }

  // The ways of changing the filter
  const { setField, clearAll } = filters

  // The filter as the layout narrows by it
  const filter = filterForView(filters.filter, mode)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Where what the layout lists stands */}
      <PoolFacet
        title={t('state')}
        options={OFFERED_STANDINGS[mode].map((standing) => ({
          value: standing,
          name: standingNames[standing],
        }))}
        counts={counts?.standingCounts}
        selected={filter.standing === null ? [] : [filter.standing]}
        onChange={(standings) => setField('standing', standings.at(-1) ?? null)}
        selectionMode="single"
      />

      {/* Which recommendation targets what the layout lists counts toward */}
      <PoolFacet
        title={t('category')}
        options={targets.map((target) => ({
          value: targetKeyOf(target),
          name: targetName(target),
        }))}
        counts={counts?.targetCounts}
        selected={filter.targets}
        onChange={(picked) => setField('targets', picked)}
      />

      {/* Which area a problem belongs to */}
      <PoolFacet
        title={t('area')}
        options={PROPOSAL_AREAS.map((area) => ({ value: area, name: areaName(area) }))}
        counts={counts?.areaCounts}
        selected={filter.areas}
        onChange={(areas) => setField('areas', areas)}
      />

      {/* The set-aside problems in place of the live ones, with how much of what the layout lists is set aside once
          that is known, the pill holding its place while the count is on its way */}
      <FacetTogglePill
        isOn={filter.isShowingSetAside}
        onToggle={() => setField('isShowingSetAside', !filter.isShowingSetAside)}
      >
        {t('setAside', { count: counts === null ? '' : counts.setAsideCount })}
      </FacetTogglePill>

      {/* The way back to everything, offered only once something narrows the layout */}
      {countActiveFilters(filter) > 0 && <FacetClearButton onClear={clearAll} />}
    </div>
  )
}

/**
 * One value a pool facet offers, with what it is called.
 *
 * @template TValue - The values the facet offers.
 */
type PoolFacetOption<TValue extends string> = {
  /** The value. */
  value: TValue
  /** What the value is called. */
  name: string
}

/**
 * Props for the {@link PoolFacet} component.
 *
 * @template TValue - The values the facet offers.
 */
type PoolFacetProps<TValue extends string> = {
  /** What the facet is called. */
  title: string
  /** Every value the facet offers with its name, in the order it lists them. */
  options: readonly PoolFacetOption<TValue>[]
  /** How much of what the layout lists holds each value; undefined until it arrives. */
  counts: Record<TValue, number> | undefined
  /** The values picked; empty for any. */
  selected: TValue[]
  /** Changes the values picked. */
  onChange: (selected: TValue[]) => void
  /** How many values may be picked at once. */
  selectionMode?: FacetSelectionMode
}

/**
 * One of the pool's facets as a pill dropdown, its picks kept in the order the facet lists its values.
 */
function PoolFacet<TValue extends string>({
  title,
  options,
  counts,
  selected,
  onChange,
  selectionMode,
}: PoolFacetProps<TValue>) {
  // Filter copy
  const t = useTranslations('problemSelection.filters')

  return (
    <MultiSelectFacet
      variant="pill"
      title={title}
      closedLabel={t('any')}
      options={options.map(({ value, name }) => ({
        id: value,
        displayName: name,
        count: counts?.[value],
      }))}
      selected={selected}
      onChange={(picked) =>
        onChange(options.map(({ value }) => value).filter((value) => picked.includes(value)))
      }
      selectionMode={selectionMode}
    />
  )
}
