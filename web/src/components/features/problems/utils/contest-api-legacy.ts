// The backend's contest shape, and the ways a node in the taxonomy projects onto it.

/**
 * A contest as the backend names it: a competition, optionally a category, optionally a round.
 * The taxonomy the client models is an arbitrary tree, so this is a projection of a node onto the
 * three levels the API understands, and it only stays faithful while the tree is at most that deep.
 */
export type LegacyApiContest = {
  /** The competition. */
  competitionSlug: string
  /** The category, absent when the contest reaches no further than its competition. */
  categorySlug?: string
  /** The round, absent when the contest stops above the round level. */
  roundSlug?: string
}

/**
 * Names a whole competition.
 *
 * @param competitionSlug - The competition.
 * @returns The contest the backend understands it as.
 */
export function legacyCompetition(competitionSlug: string): LegacyApiContest {
  // Nothing below the competition is named, which is what stands for "all of it"
  return { competitionSlug }
}

/**
 * Names one category of a competition.
 *
 * @param competitionSlug - The competition the category belongs to.
 * @param categorySlug - The category.
 * @returns The contest the backend understands it as.
 */
export function legacyCategory(competitionSlug: string, categorySlug: string): LegacyApiContest {
  // The round is left unnamed, so the category stands for every round in it
  return { competitionSlug, categorySlug }
}

/**
 * Names one round, at either of the depths a round can hang at.
 *
 * @param competitionSlug - The competition the round belongs to.
 * @param roundSlug - The round.
 * @param categorySlug - The category above it, omitted for a round hanging off the competition.
 * @returns The contest the backend understands it as.
 */
export function legacyRound(
  competitionSlug: string,
  roundSlug: string,
  categorySlug?: string
): LegacyApiContest {
  // The category is named only when the round hangs under one, since its absence tells the backend the
  // competition has no category level
  return { competitionSlug, categorySlug, roundSlug }
}
