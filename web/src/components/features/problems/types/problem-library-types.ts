// UI-specific types for the problem library
// These types are designed for React components and state management in the problem library

import type {
  CompetitionFilterOption,
  FacetOption,
  LabeledSlug,
  Problem,
} from './problem-api-types'

// #region UI Filter Types

/**
 * The possible options to filter from in the problem library
 */
export type FilterOptionsWithCounts = {
  competitions: CompetitionFilterOption[]
  seasons: FacetOption[]
  problemNumbers: FacetOption[]
  tags: FacetOption[]
  authors: FacetOption[]
}

/**
 * ContestSelection with UI-specific enhancements.
 * Adds type information and display labels for React components.
 * The API version only has slugs, but the UI needs type and label for rendering.
 */
export type ContestSelection = {
  type: 'competition' | 'category' | 'round'
  competitionSlug: string
  categorySlug?: string // undefined for competition-level or direct rounds
  roundSlug?: string // undefined for competition/category level selections
  displayName: string // Display name (e.g., "IMO", "CSMO")
  fullName?: string // Full display name (e.g., "International Mathematical Olympiad")
}

/**
 * SearchFiltersState with enhanced ContestSelection.
 * Uses the UI ContestSelection type with display labels and type information.
 * This is the state managed by React components for the problem library UI.
 */
export type SearchFiltersState = {
  searchText: string
  searchInSolution: boolean
  seasons: LabeledSlug[]
  contestSelection: ContestSelection[]
  problemNumbers: number[]
  tags: LabeledSlug[]
  tagLogic: 'or' | 'and'
  authors: LabeledSlug[]
  authorLogic: 'or' | 'and'
}

/**
 * Represents the state of filters as parsed directly from the URL.
 * This is a discriminated union that handles two distinct URL patterns:
 *
 * 1. **Filter-based URLs** (e.g., `?competitions=csmo-a&seasons=2025`):
 *    Contains filter parameters parsed before context-aware interpretation.
 *    The `competitionSelectionParts` field exists to distinguish between
 *    ambiguous formats like competition-category vs competition-round, since we can't know
 *    whether the second part is a category or a round without context.
 *    This enables concise slugs like `csmo-a` or `cpsj-i`.
 *
 * 2. **Problem ID URLs** (e.g., `?id=75-a-i-1`):
 *    Contains only a problem identifier that requires backend lookup
 *    to determine the appropriate filters.
 */
export type UrlQueryState =
  | (Omit<SearchFiltersState, 'contestSelection'> & {
      competitionSelectionParts: string[][]
    })
  | {
      problemId: string
    }
// #endregion

// #region UI Response Types

/**
 * Response type for filter operations.
 * Uses UI FilterOptionsWithCounts instead of API SearchBarOptions.
 */
export type FilterResponse = {
  problems: {
    items: Problem[]
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  updatedOptions: FilterOptionsWithCounts | null
}

/**
 * Result type for single problem pages.
 * Combines problem data with frontend filter state and options.
 */
export type SingleProblemResult = {
  problem: Problem
  filters: SearchFiltersState
  options: FilterOptionsWithCounts
}

// #endregion
