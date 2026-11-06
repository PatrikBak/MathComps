'use client'

import { useTranslations } from 'next-intl'

import {
  FacetClearButton,
  FacetTogglePill,
} from '@/components/shared/components/facets/components/FacetBarControls'
import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import type { FacetSelectionMode } from '@/components/shared/components/facets/model/facet-types'

import { useAreaName } from '../hooks/use-area-name'
import { useCategoryLabel } from '../hooks/use-category-label'
import type { UsePoolFiltersResult } from '../hooks/use-pool-filters'
import {
  countActiveFilters,
  filterForView,
  OFFERED_STANDINGS,
  type PoolCounts,
  type PoolStanding,
} from '../model/pool-filters'
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

  // The selection's categories by name, in the order they run; none until its read lands
  const categoryNames =
    useSelectionWorkspace().selection?.categories.map((category) => category.name) ?? []

  // What each category is called
  const categoryLabel = useCategoryLabel()

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
        values={OFFERED_STANDINGS[mode]}
        nameOf={(standing) => standingNames[standing]}
        counts={counts?.standingCounts}
        selected={filter.standing === null ? [] : [filter.standing]}
        onChange={(standings) => setField('standing', standings.at(-1) ?? null)}
        selectionMode="single"
      />

      {/* Which categories what the layout lists counts toward */}
      <PoolFacet
        title={t('category')}
        values={categoryNames}
        nameOf={categoryLabel}
        counts={counts?.categoryCounts}
        selected={filter.categories}
        onChange={(categories) => setField('categories', categories)}
      />

      {/* Which area a problem belongs to */}
      <PoolFacet
        title={t('area')}
        values={PROPOSAL_AREAS}
        nameOf={areaName}
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
 * Props for the {@link PoolFacet} component.
 *
 * @template TValue - The values the facet offers.
 */
type PoolFacetProps<TValue extends string> = {
  /** What the facet is called. */
  title: string
  /** Every value the facet offers, in the order it lists them. */
  values: readonly TValue[]
  /** Names a value. */
  nameOf: (value: TValue) => string
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
  values,
  nameOf,
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
      options={values.map((value) => ({
        id: value,
        displayName: nameOf(value),
        count: counts?.[value],
      }))}
      selected={selected}
      onChange={(picked) => onChange(values.filter((value) => picked.includes(value)))}
      selectionMode={selectionMode}
    />
  )
}
