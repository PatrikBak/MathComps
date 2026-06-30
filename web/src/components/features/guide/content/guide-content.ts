import guideJson from '@/content/guide.json'

import {
  COMPETITION_KINDS,
  type GuideContent,
  type OtherCompetition,
  type Resource,
  RESOURCE_BUCKETS,
  RESOURCE_LEVELS,
  type ResourceBucket,
  type ResourceLevel,
  SCHOOL_LEVELS,
  type SchoolLevel,
  type Seminar,
} from './guide-content-types'
import { FILTER_COUNTRIES, type FilterCountry, type GuideFilters } from './guide-filters'

/** The guide content; its runtime shape is validated at build time. */
export const GUIDE_CONTENT = guideJson as unknown as GuideContent

/**
 * Tests whether an "other competition" matches the active filter selection.
 *
 * @param competition - The competition to test.
 * @param filters - The current single-select filters.
 *
 * @returns True when the competition passes every active filter.
 */
export function matchesOtherCompetition(
  competition: OtherCompetition,
  filters: GuideFilters
): boolean {
  // Level matches when unset or present in the competition's levels
  const levelOk = !filters.schoolLevel || competition.levels.includes(filters.schoolLevel)
  // Kind matches when unset or equal
  const kindOk = !filters.kind || competition.kind === filters.kind
  // Country matches when unset or present in the competition's countries
  const countryOk = !filters.country || competition.countries.includes(filters.country)
  // Pass only when all hold
  return levelOk && kindOk && countryOk
}

/**
 * Tests whether a seminar matches the active filter selection.
 *
 * @param seminar - The seminar to test.
 * @param filters - The current single-select filters.
 *
 * @returns True when the seminar passes every active filter.
 */
export function matchesSeminar(seminar: Seminar, filters: GuideFilters): boolean {
  // Level matches when unset or equal
  const levelOk = !filters.schoolLevel || seminar.level === filters.schoolLevel
  // Country matches when unset or present in the seminar's countries
  const countryOk = !filters.country || seminar.countries.includes(filters.country)
  // Pass only when both hold
  return levelOk && countryOk
}

/**
 * Tests whether a resource matches the active filter selection.
 *
 * @param resource - The resource to test.
 * @param filters - The current single-select filters.
 *
 * @returns True when the resource passes every active filter.
 */
export function matchesResource(resource: Resource, filters: GuideFilters): boolean {
  // Bucket matches when unset or equal
  const bucketOk = !filters.bucket || resource.bucket === filters.bucket
  // Experience level matches when unset or equal
  const levelOk = !filters.resourceLevel || resource.level === filters.resourceLevel
  // Pass only when both hold
  return bucketOk && levelOk
}

/**
 * Collects the school levels actually present across a set of competitions/seminars,
 * in canonical order.
 *
 * @param levelLists - The per-entity level membership.
 *
 * @returns The present levels in canonical order.
 */
function presentLevels(levelLists: SchoolLevel[][]): SchoolLevel[] {
  // Flatten every entity's levels into one set
  const present = new Set(levelLists.flat())
  // Keep canonical order, drop absent
  return SCHOOL_LEVELS.filter((level) => present.has(level))
}

/**
 * Collects the countries actually present, in canonical order.
 *
 * @param countryLists - The per-entity country membership.
 *
 * @returns The present filter countries in canonical order.
 */
function presentCountries(countryLists: FilterCountry[][]): FilterCountry[] {
  // Flatten every entity's countries into one set
  const present = new Set(countryLists.flat())
  // Keep canonical order, drop absent
  return FILTER_COUNTRIES.filter((country) => present.has(country))
}

/** The filter facets available on the "other competitions" page, derived from the data. */
export const OTHER_COMPETITION_FACETS = {
  /** Levels present across other competitions. */
  levels: presentLevels(GUIDE_CONTENT.otherCompetitions.map((competition) => competition.levels)),
  /** Kinds present across other competitions. */
  kinds: COMPETITION_KINDS.filter((kind) =>
    GUIDE_CONTENT.otherCompetitions.some((competition) => competition.kind === kind)
  ),
  /** Countries present across other competitions. */
  countries: presentCountries(
    GUIDE_CONTENT.otherCompetitions.map((competition) => competition.countries as FilterCountry[])
  ),
}

/** The filter facets available on the "seminars" page, derived from the data. */
export const SEMINAR_FACETS = {
  /** Levels present across seminars. */
  levels: presentLevels(GUIDE_CONTENT.seminars.map((seminar) => [seminar.level])),
  /** Countries present across seminars. */
  countries: presentCountries(
    GUIDE_CONTENT.seminars.map((seminar) => seminar.countries as FilterCountry[])
  ),
}

/** The filter facets available on the "resources" page, derived from the data. */
export const RESOURCE_FACETS = {
  /** Buckets present across resources, in canonical order. */
  buckets: RESOURCE_BUCKETS.filter((bucket) =>
    GUIDE_CONTENT.resources.some((resource) => resource.bucket === bucket)
  ) as ResourceBucket[],
  /** Experience levels present across resources, in canonical order. */
  levels: RESOURCE_LEVELS.filter((level) =>
    GUIDE_CONTENT.resources.some((resource) => resource.level === level)
  ) as ResourceLevel[],
}
