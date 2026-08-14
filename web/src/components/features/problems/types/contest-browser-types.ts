/**
 * Types for the contest browser API response, matching the C# backend.
 */

/**
 * Result for the contest browser, grouping contests by season with problem counts.
 */
export type SeasonContestBrowserResult = {
  /** The seasons available in the contest browser, pre-sorted from the most recent to the oldest. */
  seasons: SeasonContestsGroup[]
}

/**
 * A single season with its available contests.
 */
export type SeasonContestsGroup = {
  /** The edition number of the season (e.g. 75. ročník). */
  editionNumber: number
  /** The edition label of the season (e.g. 2024/2025). */
  editionLabel: string
  /** The contests available in the season. */
  contests: ContestWithCount[]
}

/**
 * A flattened contest entry with full display name and problem count.
 */
export type ContestWithCount = {
  /** The contest, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  path: string
  /** The display name of every contest down to this one, root-first. */
  labels: string[]
  /** The slug of the competition. */
  competitionSlug: string
  /** The slug of the category, if the selected competition has categories (e.g. home rounds have, IMO does not). */
  categorySlug: string | null
  /** The slug of the round, if the selected category has rounds (e.g. MEMO has (individual & team), IMO does not). */
  roundSlug: string | null
  /** The display name of the competition. */
  competitionName: string
  /** The display name of the category, if applicable. */
  categoryName: string | null
  /** The display name of the round, if applicable. */
  roundName: string | null
  /** The number of problems in the contest. */
  problemCount: number
}
