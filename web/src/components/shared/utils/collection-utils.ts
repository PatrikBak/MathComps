/**
 * Toggles an item in a Set (immutably). If the item exists, it is removed;
 * if it doesn't exist, it is added.
 *
 * @param set - The original Set
 * @param item - The item to toggle
 *
 * @returns A new Set with the item toggled
 */
export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  // Clone the set so we don't mutate the caller's
  const newSet = new Set(set)
  // Drop the item if present, otherwise add it
  newSet.has(item) ? newSet.delete(item) : newSet.add(item)
  // Hand back the toggled set
  return newSet
}

/**
 * Inverts a key → value record into a value → key Map. When two keys share a value, the last one wins.
 *
 * @param record - The key/value pairs to reverse.
 *
 * @returns The value → key lookup.
 */
export function invert<TKey extends string>(record: Record<TKey, string>): Map<string, TKey> {
  // Walk each key/value pair into the reverse map
  return new Map((Object.entries(record) as [TKey, string][]).map(([key, value]) => [value, key]))
}

/**
 * Whether two lists name the same things, in whatever order each happens to list them and however often
 * either repeats one. Two items are the same one when they are the same value or the very same object, so a
 * pair of look-alike objects is a pair of different things.
 *
 * @param left - One list.
 * @param right - The other list.
 *
 * @returns True when each list names exactly what the other does.
 */
export function namesTheSameItems<T>(left: readonly T[], right: readonly T[]): boolean {
  // What each names, with the order and any repeats dropped
  const named = new Set(left)
  const others = new Set(right)

  // Equal counts plus one-way containment settles it
  return named.size === others.size && [...named].every((item) => others.has(item))
}

/**
 * Narrows a raw value to a member of an allowed set, or null when it matches none. Handy for trusting
 * an external string (a URL query, a stored value) as a literal-union member before using it.
 *
 * @param value - The raw value to check; a missing value never matches.
 * @param allowed - The permitted members.
 *
 * @returns The value typed as a member when it's in the set, otherwise null.
 */
export function parseMember<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[]
): T | null {
  // A missing value matches nothing
  if (value === null || value === undefined) return null

  // Keep it only when it's an exact member of the set
  return allowed.includes(value as T) ? (value as T) : null
}
