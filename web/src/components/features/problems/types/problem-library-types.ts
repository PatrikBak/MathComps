// Types for the problem library's filters, the options they are picked from, and the
// responses they produce

import type { PagedList } from '@/lib/api/paged-list'

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
 * A whole competition, standing for every problem in it.
 */
type CompetitionContestSelection = {
  /** Names this as a competition-level selection. */
  type: 'competition'
  /** The competition selected. */
  competitionSlug: string
  /** How the selection reads, e.g. "IMO". */
  displayName: string
  /** The unabbreviated name, e.g. "International Mathematical Olympiad". */
  fullName?: string
}

/**
 * One category of a competition, standing for every round in it.
 */
type CategoryContestSelection = {
  /** Names this as a category-level selection. */
  type: 'category'
  /** The competition the category belongs to. */
  competitionSlug: string
  /** The category selected. */
  categorySlug: string
  /** How the selection reads, e.g. "SKMO - Kategória A". */
  displayName: string
  /** The unabbreviated name. */
  fullName?: string
}

/**
 * One round, which sits under a category in competitions that have that level and
 * directly under the competition in those that do not.
 */
export type RoundContestSelection = {
  /** Names this as a round-level selection. */
  type: 'round'
  /** The competition the round belongs to. */
  competitionSlug: string
  /** The category the round sits under, absent in competitions with no category level. */
  categorySlug?: string
  /** The round selected. */
  roundSlug: string
  /** How the selection reads, e.g. "SKMO - Kategória A - Školské kolo". */
  displayName: string
  /** The unabbreviated name. */
  fullName?: string
}

/**
 * One competition filter, held at whatever level of the hierarchy the user picked, so
 * taking a whole competition records one entry rather than every round in it, carried
 * alongside the names it reads under.
 */
export type ContestSelection =
  | CompetitionContestSelection
  | CategoryContestSelection
  | RoundContestSelection

/**
 * Filter values for problem mark status.
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
 * The filters as the URL holds them, before a competition filter's level is resolved.
 */
export type UrlQueryState = Omit<SearchFiltersState, 'contestSelection'> & {
  /**
   * The competition filters, each as its bare slug parts, since a slug like `csmo-a` does
   * not say on its own whether the second part is a category or a round.
   */
  competitionSelectionParts: string[][]
}

/**
 * One page of problems, with the option counts that page implies.
 */
export type FilterResponse = {
  /** The page of matching problems. */
  problems: PagedList<Problem>
  /** The option counts under these filters, absent when they cannot have changed. */
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
 * A single problem alongside the filters that resolve to exactly it.
 */
export type SingleProblemResult = {
  /** The problem itself. */
  problem: Problem
  /** Filters that resolve to exactly this problem. */
  filters: SearchFiltersState
  /** The options those filters would be picked from. */
  options: FilterOptionsWithCounts
}
