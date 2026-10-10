'use client'

import { useTranslations } from 'next-intl'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { HOSTED_COMPETITION_CATEGORIES } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import {
  FacetClearButton,
  FacetTogglePill,
} from '@/components/shared/components/facets/components/FacetBarControls'
import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import type { FacetSelectionMode } from '@/components/shared/components/facets/model/facet-types'

import { useAreaName } from '../hooks/use-area-name'
import type { UsePoolFiltersResult } from '../hooks/use-pool-filters'
import { BOARD_MEMBERSHIPS, type BoardMembership, type PoolMatches } from '../model/pool-filters'
import { PROPOSAL_AREAS } from '../model/selection-types'

/**
 * Props for the {@link PoolFilterBar} component.
 */
type PoolFilterBarProps = {
  /** What the pool is narrowed to, and the ways of changing it. */
  filters: UsePoolFiltersResult
  /** What the filter lets through, with the counts beside each option; null until the selection arrives. */
  matches: PoolMatches | null
}

/**
 * The row of filters over the pool: a pill dropdown per facet whose options carry their counts, and a pill for
 * the set-aside problems.
 */
export function PoolFilterBar({ filters, matches }: PoolFilterBarProps) {
  // Filter copy
  const t = useTranslations('problemSelection.filters')

  // What each category is called
  const categoryName = useCategoryName()

  // What each area is called
  const areaName = useAreaName()

  // What each board membership is called
  const membershipNames: Record<BoardMembership, string> = {
    selected: t('selected'),
    notSelected: t('notSelected'),
  }

  // The filter as it stands, the ways of changing it, and how many of its fields narrow
  const { filter, setField, clearAll, activeCount } = filters

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Whether the board on screen holds a problem */}
      <PoolFacet
        title={t('state')}
        values={BOARD_MEMBERSHIPS}
        nameOf={(membership) => membershipNames[membership]}
        counts={matches?.membershipCounts}
        selected={filter.membership === null ? [] : [filter.membership]}
        onChange={(memberships) => setField('membership', memberships.at(-1) ?? null)}
        selectionMode="single"
      />

      {/* Which categories a problem is recommended for */}
      <PoolFacet
        title={t('category')}
        values={HOSTED_COMPETITION_CATEGORIES}
        nameOf={categoryName}
        counts={matches?.categoryCounts}
        selected={filter.categories}
        onChange={(categories) => setField('categories', categories)}
      />

      {/* Which area a problem belongs to */}
      <PoolFacet
        title={t('area')}
        values={PROPOSAL_AREAS}
        nameOf={areaName}
        counts={matches?.areaCounts}
        selected={filter.areas}
        onChange={(areas) => setField('areas', areas)}
      />

      {/* The set-aside problems in place of the live ones, offered once their count is known */}
      {matches !== null && (
        <FacetTogglePill
          isOn={filter.isShowingSetAside}
          onToggle={() => setField('isShowingSetAside', !filter.isShowingSetAside)}
        >
          {t('setAside', { count: matches.setAsideCount })}
        </FacetTogglePill>
      )}

      {/* The way back to everything, offered only once something is narrowing */}
      {activeCount > 0 && <FacetClearButton onClear={clearAll} />}
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
  /** How many problems hold each value; undefined until the selection arrives. */
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
      showSearch={false}
    />
  )
}
