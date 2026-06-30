import {
  type CompetitionKind,
  type Country,
  type GuidePage,
  type ResourceBucket,
  type ResourceLevel,
  type SchoolLevel,
} from './guide-content-types'

/** Countries offered as a filter facet. */
export const FILTER_COUNTRIES = [
  'SK',
  'CZ',
  'PL',
  'INTERNATIONAL',
] as const satisfies readonly Country[]

/** A country usable as a filter facet. */
export type FilterCountry = (typeof FILTER_COUNTRIES)[number]

/**
 * The single-select filter state for the active page (null means "all"). This is the union of every
 * facet across all deck pages; any given page uses only its own subset and leaves the rest null.
 */
export type GuideFilters = {
  /** Selected school level, or null for all. */
  schoolLevel: SchoolLevel | null
  /** Selected competition kind, or null for all. */
  kind: CompetitionKind | null
  /** Selected country, or null for all. */
  country: FilterCountry | null
  /** Selected resource bucket, or null for all. */
  bucket: ResourceBucket | null
  /** Selected resource experience level, or null for all. */
  resourceLevel: ResourceLevel | null
}

/** The full deck view: which page is shown and its filter selections. */
export type GuideDeckState = {
  /** The active deck page. */
  page: GuidePage
  /** The active page's filter selections. */
  filters: GuideFilters
}

/** Empty (default) filter selection. */
export const EMPTY_FILTERS: GuideFilters = {
  schoolLevel: null,
  kind: null,
  country: null,
  bucket: null,
  resourceLevel: null,
}
