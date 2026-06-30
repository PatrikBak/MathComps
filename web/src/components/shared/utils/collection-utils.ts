/**
 * Toggles an item in a Set (immutably). If the item exists, it is removed;
 * if it doesn't exist, it is added.
 *
 * @param set The original Set
 * @param item The item to toggle
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
 * Inverts a key → value record into a value → key Map.
 *
 * @param record - The key/value pairs to reverse.
 *
 * @returns The value → key lookup.
 */
export function invert<TKey extends string>(record: Record<TKey, string>): Map<string, TKey> {
  // Walk each key/value pair into the reverse map
  return new Map((Object.entries(record) as [TKey, string][]).map(([key, value]) => [value, key]))
}
