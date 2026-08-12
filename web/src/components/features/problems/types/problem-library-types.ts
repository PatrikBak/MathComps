// Types for the problem library's filters, the options they are picked from, and the
// responses they produce

import type { PagedList } from '@/lib/api/paged-list'

import type { LegacyApiContest } from '../utils/contest-api-legacy'
import type {
  CompetitionFilterOption,
  FacetOption,
  LabeledSlug,
  Problem,
} from './problem-api-types'

/**
 * Everything the library can be filtered by, each option carrying how many problems it
 * covers, either across the whole library or under a given filter.
 */
export type FilterOptionsWithCounts = {
  /** The competition hierarchy, with its categories and rounds nested inside it. */
  competitions: CompetitionFilterOption[]
  /** The school years problems were set in. */
  seasons: FacetOption[]
  /** The positions a problem can hold within its round. */
  problemNumbers: FacetOption[]
  /** The topics and techniques problems are tagged with. */
  tags: FacetOption[]
  /** The people who wrote the problems. */
  authors: FacetOption[]
}

/**
 * One competition filter, held at whatever depth of the taxonomy the user picked, so taking a
 * whole competition records one entry rather than every round in it. It carries no names of its
 * own: whatever shows the filter reads those off the node its path resolves to.
 */
export type ContestSelection = {
  /** The node the filter names, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  path: string
  /** How the backend names that same node. */
  apiSelection: LegacyApiContest
}

/**
 * The mark state a problem can be in.
 */
export type MarkStatusFilter = 'marked' | 'unmarked'

/**
 * Everything the library is currently filtered by.
 */
export type SearchFiltersState = {
  /** The term searched for. */
  searchText: string
  /** Whether the search reaches into solutions as well as statements. */
  searchInSolution: boolean
  /** The school years filtered on. */
  seasons: LabeledSlug[]
  /** The competitions filtered on, each held at the level the user picked. */
  contestSelection: ContestSelection[]
  /** The positions within a round filtered on. */
  problemNumbers: number[]
  /** The tags filtered on. */
  tags: LabeledSlug[]
  /** Whether a problem has to carry any of the tags or all of them. */
  tagLogic: 'or' | 'and'
  /** The authors filtered on. */
  authors: LabeledSlug[]
  /** Whether a problem has to carry any of the authors or all of them. */
  authorLogic: 'or' | 'and'
  /** Whether to show only the problems the user has liked. */
  favoritesOnly: boolean
  /** Whether to show only marked or only unmarked problems, or not to care. */
  markStatus: MarkStatusFilter | null
  /** The list being browsed, null when browsing everything. */
  listContentId: string | null
}

/**
 * The filters as the URL holds them, before a competition filter is resolved against the taxonomy.
 */
export type UrlQueryState = Omit<SearchFiltersState, 'contestSelection'> & {
  /** The competition filters, each as the bare path it was written as, resolved or not. */
  contestPaths: string[]
}

/**
 * One page of problems, with the option counts that page implies.
 */
export type FilterResponse = {
  /** The page of matching problems. */
  problems: PagedList<Problem>
  /** The option counts under these filters, null when they cannot have changed. */
  updatedOptions: FilterOptionsWithCounts | null
  /** The name of the list being browsed, null when browsing everything. */
  listName: string | null
}

/**
 * A filter response as it arrives over the wire, before the nesting is flattened away.
 */
export type RawProblemFilterResponse = {
  /** The page of problems and the option counts. */
  filterResult: FilterResponse
  /** The name of the list being browsed, null when browsing everything. */
  listName: string | null
}

/**
 * A single problem, together with the filter state the library would show it under.
 */
export type SingleProblemResult = {
  /** The problem itself. */
  problem: Problem
  /** Filters that resolve to exactly this problem. */
  filters: SearchFiltersState
  /** The options those filters would be picked from. */
  options: FilterOptionsWithCounts
}
