/**
 * What a save says about the student's competing.
 *
 * Every field goes every time, so a null clears what stood before.
 */
export type UserCompetitionProfile = {
  /** The year they finish secondary school, or null while they have not said or already have. */
  graduationYear: number | null
  /** Whether they are past high school, and so have no age group to be listed against. */
  hasLeftHighSchool: boolean
  /** Where they compete from as an ISO 3166-1 alpha-2 code, or null while they have not said. */
  countryCode: string | null
}

/**
 * What the site holds on the signed-in user's own account.
 */
export type UserProfile = UserCompetitionProfile & {
  /** The name the site calls them by, or null while they have yet to choose one. */
  username: string | null
}
