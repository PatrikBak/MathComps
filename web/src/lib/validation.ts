/**
 * Checks for duplicate IDs in a list of items.
 *
 * @param items Array of items to check.
 * @param getId Function to extract ID from an item. Should return undefined/null if item has no ID (which will be ignored).
 * @param context Context name for the error message (e.g. "news article").
 *
 * @throws Error if duplicate IDs are found.
 */
export function validateUniqueIds<T>(
  items: T[],
  getId: (item: T) => string | undefined | null,
  context: string
) {
  // Collect defined ids from items
  const ids = items.map(getId).filter((id): id is string => !!id)

  // Find duplicates in ids
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)

  // If duplicates are found
  if (duplicates.length > 0) {
    // Deduplicate the list of duplicate IDs for the error message
    const uniqueDuplicates = Array.from(new Set(duplicates))

    // Throw an error with a new error message
    throw new Error(`Duplicate ${context} IDs found: ${uniqueDuplicates.join(', ')}`)
  }
}
