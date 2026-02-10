/**
 * Frontend mirror of UserListDto from the backend.
 */
export type UserListDto = {
  /** Short, URL-friendly identifier for this list */
  contentId: string
  /** Display name of the list */
  name: string
  /** Number of problems currently in this list */
  problemCount: number
  /** Whether this list is publicly shared */
  isShared: boolean
}

/**
 * Response from the GET /users/me/lists endpoint.
 * Bundles the liked count with user-created lists.
 */
export type UserListsResponse = {
  /** Number of problems the user has liked */
  likedCount: number
  /** User-created lists with their metadata, ordered by sort order */
  lists: UserListDto[]
}
