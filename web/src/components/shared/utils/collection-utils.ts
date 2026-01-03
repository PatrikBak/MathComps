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
  const newSet = new Set(set)
  newSet.has(item) ? newSet.delete(item) : newSet.add(item)
  return newSet
}
