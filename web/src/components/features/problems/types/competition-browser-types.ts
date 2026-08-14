/**
 * Types for the competition browser API response, matching the C# backend.
 */

/**
 * Result for the competition browser, grouping competitions by season with problem counts.
 */
export type SeasonCompetitionBrowserResult = {
  /** The seasons available in the competition browser, pre-sorted from the most recent to the oldest. */
  seasons: SeasonCompetitionsGroup[]
}

/**
 * A single season with its available competitions.
 */
export type SeasonCompetitionsGroup = {
  /** The edition number of the season (e.g. 75. ročník). */
  editionNumber: number
  /** The edition label of the season (e.g. 2024/2025). */
  editionLabel: string
  /** The competitions available in the season. */
  competitions: CompetitionWithCount[]
}

/**
 * A flattened competition entry with full display name and problem count.
 */
export type CompetitionWithCount = {
  /** The competition, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  path: string
  /** The display name of every competition down to this one, root-first. */
  labels: string[]
  /** The number of problems in the competition. */
  problemCount: number
}
