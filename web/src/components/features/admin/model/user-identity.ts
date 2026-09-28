/**
 * Somebody an admin surface names. The username can be missing, so the address rides alongside it.
 */
export type UserIdentity = {
  /** Stable identifier. */
  id: string
  /** The name the site calls them by; null while they have chosen none, and once their account is deleted. */
  username: string | null
  /** Their address; null when there is none, as for every deleted account. */
  email: string | null
}

/**
 * Names somebody on an admin surface, since either half of what identifies them can be missing.
 *
 * @param user - The person to name.
 * @param unnamedLabel - What to call somebody the site holds neither a name nor an address for.
 *
 * @returns Their username, their address when they have chosen no name, and the label when neither is left.
 */
export function describeUser(user: UserIdentity, unnamedLabel: string): string {
  // Whichever half the site still holds, and the label when it holds neither
  return user.username ?? user.email ?? unnamedLabel
}
