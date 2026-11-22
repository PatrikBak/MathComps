import { useTranslations } from 'next-intl'

import type { FloatingPanelSurface } from '@/components/shared/components/DropdownMenu'
import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import { TreeSelectFacet } from '@/components/shared/components/facets/components/TreeSelectFacet'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import type { LabeledSlug, TagType } from '../types/problem-api-types'
import { createFilterUpdater } from '../utils/filter-update-utils'
import { FilterSearchBox } from './FilterSearchBox'
import { ListsDropdown } from './ListsDropdown'

/**
 * The values a facet picked, as the filter holds them. A facet hands back slugs alone, so each value carries its slug
 * as its name.
 *
 * @param slugs - The slugs the facet picked.
 * @returns The filter's values.
 */
function asFilterValues(slugs: string[]): LabeledSlug[] {
  // Each slug, standing in for its own name
  return slugs.map((slug) => ({ slug, displayName: slug, fullName: null }))
}

/**
 * Whether the filters take a card of their own on each surface they stand on.
 */
const HAS_OWN_FRAME: Record<FloatingPanelSurface, boolean> = {
  page: true,
  card: false,
}

/**
 * Where the filters sit: fixed beside the list once there is room for the sidebar, filling whatever holds them below
 * that.
 */
const SIDEBAR_CLASS =
  'flex flex-col lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]'

/**
 * The props of {@link SearchFilters}.
 */
type SearchFiltersProps = UseSearchFiltersLogicProps & {
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName: string | null
  /** Called once the user has settled on a body of problems. */
  onListPicked?: () => void
  /**
   * What the filters stand on: the page, where they take a card of their own, or a panel that frames them already.
   * Their dropdowns open over the same.
   */
  standsOn: FloatingPanelSurface
}

/**
 * The problem library's filter sidebar: the list to search in, the full-text search, then the facets.
 */
export const SearchFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
  sharedListName,
  onListPicked,
  standsOn,
}: SearchFiltersProps) => {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  // Everything the facets render from, and the one handler the tree writes back through
  const {
    competitionTreeOpts,
    defaultExpandedIds,
    selectedTreeIds,
    handleCompetitionTreeChange,
    seasonOpts,
    tagOpts,
    authorOpts,
    numberOpts,
  } = useSearchFiltersLogic({
    filters,
    onFiltersChange,
    filterOptions,
    baseOptions,
  })

  // A function which writes one filter back, carrying the rules that tie filters together
  const updateFilter = createFilterUpdater(filters, onFiltersChange)

  // Each kind of tag, named as its section of the tag facet, in the order the facet lists the sections
  const tagGroupLabels: Record<TagType, string> = {
    area: t('facets.grouping.area'),
    type: t('facets.grouping.type'),
    goal: t('facets.grouping.goal'),
    technique: t('facets.grouping.technique'),
  }

  // The scrolling body, holding every facet
  const body = (
    <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:min-h-0">
      <div className="space-y-5 sm:space-y-6">
        {/* List picker */}
        <div>
          <ListsDropdown
            filters={filters}
            onFiltersChange={onFiltersChange}
            sharedListName={sharedListName}
            onListPicked={onListPicked}
            opensOver={standsOn}
          />
        </div>

        {/* Full-text search */}
        <FilterSearchBox filters={filters} onFiltersChange={onFiltersChange} />

        {/* Facets: where a problem came from, what it is about, and who wrote it */}
        <div className="space-y-3 sm:space-y-4">
          <TreeSelectFacet
            title={t('facets.competition')}
            options={competitionTreeOpts}
            selected={selectedTreeIds}
            onChange={handleCompetitionTreeChange}
            search={{ placeholder: t('facets.searchCompetitions') }}
            closedLabel={t('facets.allCompetitions')}
            defaultExpandedIds={defaultExpandedIds}
            opensOver={standsOn}
          />

          <MultiSelectFacet
            title={t('facets.season')}
            options={seasonOpts}
            selected={filters.seasons.map((item) => item.slug)}
            onChange={(slugs) => updateFilter('seasons', asFilterValues(slugs))}
            search={{ placeholder: t('facets.searchSeasons') }}
            closedLabel={t('facets.allSeasons')}
            opensOver={standsOn}
          />

          <MultiSelectFacet
            title={t('facets.problemNumber')}
            options={numberOpts}
            selected={filters.problemNumbers.map(String)}
            onChange={(numbers) =>
              updateFilter(
                'problemNumbers',
                numbers.map((number) => parseInt(number, 10))
              )
            }
            closedLabel={t('facets.anyOrder')}
            opensOver={standsOn}
          />

          <MultiSelectFacet
            title={t('facets.tags')}
            titleTooltip={t('facets.tagsTooltip')}
            closedLabel={t('facets.selectTags')}
            options={tagOpts}
            selected={filters.tags.map((item) => item.slug)}
            onChange={(slugs) => updateFilter('tags', asFilterValues(slugs))}
            search={{ placeholder: t('facets.searchTags') }}
            logic={{
              mode: filters.tagLogic,
              onChange: (mode) => updateFilter('tagLogic', mode),
              labels: {
                or: t('facets.logic.or'),
                and: t('facets.logic.and'),
              },
            }}
            grouping={{ keys: Object.keys(tagGroupLabels) as TagType[], labels: tagGroupLabels }}
            opensOver={standsOn}
          />

          <MultiSelectFacet
            title={t('facets.authors')}
            closedLabel={t('facets.selectAuthors')}
            options={authorOpts}
            selected={filters.authors.map((item) => item.slug)}
            onChange={(slugs) => updateFilter('authors', asFilterValues(slugs))}
            search={{ placeholder: t('facets.searchAuthors') }}
            logic={{
              mode: filters.authorLogic,
              onChange: (mode) => updateFilter('authorLogic', mode),
            }}
            opensOver={standsOn}
          />
        </div>
      </div>
    </div>
  )

  // The filters, in a card of their own where they stand on the page, and bare inside a panel that frames them
  return HAS_OWN_FRAME[standsOn] ? (
    <SurfacePanel radius="xl" className={SIDEBAR_CLASS}>
      {body}
    </SurfacePanel>
  ) : (
    <div className={SIDEBAR_CLASS}>{body}</div>
  )
}
