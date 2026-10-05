/**
 * What a save says about the student's competing.
 *
 * Every field goes every time, so a null clears what stood before.
 */
export type UserCompetitionProfile = {
  /**
   * The year they finish secondary school, or null while they have not said or when they finished before
   * the competition first ran.
   */
  graduationYear: number | null
  /**
   * Whether they finished high school before the competition first ran, and so were past it at every
   * round.
   */
  hasLeftHighSchool: boolean
  /** Where they compete from as an ISO 3166-1 alpha-2 code, or null while they have not said. */
  countryCode: string | null
}

/**
 * What the site holds on the signed-in user's own account.
 */
export type UserProfile = UserCompetitionProfile & {
  /** The address the site has for them, or null when their account carries none. */
  email: string | null
  /** The name the site calls them by, or null while they have yet to choose one. */
  username: string | null
}
