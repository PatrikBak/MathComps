// Types for the problem library's filters, the options they are picked from, and the
// responses they produce

import type { PagedList } from '@/lib/api/paged-list'

import type {
  CompetitionNodeOption,
  FacetOption,
  LabeledSlug,
  LogicToggle,
  MarkStatusFilter,
  Problem,
  TagFacetOption,
} from './problem-api-types'

/**
 * Everything the library can be filtered by, each option carrying how many problems it
 * covers, either across the whole library or under a given filter.
 */
export type FilterOptionsWithCounts = {
  /** The competitions as the tree they form, each carrying everything below it. */
  competitions: CompetitionNodeOption[]
  /** The school years problems were set in. */
  seasons: FacetOption[]
  /** The positions a problem can hold within its round. */
  problemNumbers: FacetOption[]
  /** The topics and techniques problems are tagged with. */
  tags: TagFacetOption[]
  /** The people who wrote the problems. */
  authors: FacetOption[]
}

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
  /**
   * The competitions filtered on, each as the slugs leading down to the node the user picked, e.g.
   * `csmo-a-i`, so taking a whole competition records one path rather than every round in it.
   */
  competitionSelection: string[]
  /** The positions within a round filtered on. */
  problemNumbers: number[]
  /** The tags filtered on. */
  tags: LabeledSlug[]
  /** Whether a problem has to carry any of the tags or all of them. */
  tagLogic: LogicToggle
  /** The authors filtered on. */
  authors: LabeledSlug[]
  /** Whether a problem has to carry any of the authors or all of them. */
  authorLogic: LogicToggle
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
export type UrlQueryState = Omit<SearchFiltersState, 'competitionSelection'> & {
  /** The competition filters, each as the bare path it was written as, resolved or not. */
  competitionPaths: string[]
}

/**
 * One page of problems and the option counts it implies, as the archive endpoints put it on the wire.
 */
export type FilterResult = {
  /** The page of matching problems. */
  problems: PagedList<Problem>
  /**
   * Every option the library offers, counted across the whole archive rather than across what these
   * filters narrow to. Present when the caller asked for it and this is the first page.
   */
  baseOptions: FilterOptionsWithCounts | null
  /**
   * The options of {@link FilterResult.baseOptions}, counted across what these filters narrow to
   * instead. Present on the first page of a search that narrows anything; a search that narrows
   * nothing is already answered by the counts across the whole archive.
   */
  updatedOptions: FilterOptionsWithCounts | null
}

/**
 * A search's answer, as the filter endpoint puts it on the wire: the page, plus what the search itself
 * was made of that the page cannot say.
 */
export type ProblemFilterResponse = {
  /** The page of problems and the option counts. */
  filterResult: FilterResult
  /** The name of the list being browsed, null when browsing everything. */
  listName: string | null
}

/**
 * Where one problem sits, which is everything a filter needs to name it and nothing else.
 */
type ProblemPosition = {
  /** The edition of the olympiad it was set in, e.g. 75 for the 75th. */
  season: number
  /** The competition it was set in, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  competitionPath: string
  /** Its position within that competition. */
  problemNumber: number
}

/**
 * One problem's answer, as the single-problem endpoint puts it on the wire: the page holding it, plus
 * what the archive looked it up as.
 */
export type SingleProblemResponse = {
  /** The one-problem page and the option counts. */
  filterResult: FilterResult
  /** Where the archive found the problem, which is what that page was fetched under. */
  filters: ProblemPosition
}

/**
 * One page of problems as the service hands it on, which is a {@link ProblemFilterResponse} with the
 * nesting flattened away so a caller reads one object rather than reaching through two.
 */
export type FilterResponse = FilterResult & {
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
  /** {@link FilterResult.baseOptions}. */
  baseOptions: FilterOptionsWithCounts | null
  /**
   * {@link FilterResult.updatedOptions}, which {@link SingleProblemResult.filters} narrows to this
   * problem alone, so the archive always owes them.
   */
  options: FilterOptionsWithCounts
}
