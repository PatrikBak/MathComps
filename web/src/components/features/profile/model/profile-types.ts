/**
 * What the site holds on the signed-in user's own account.
 */
export type UserProfile = {
  /** The name the site calls them by, or null while they have yet to choose one. */
  username: string | null
}
