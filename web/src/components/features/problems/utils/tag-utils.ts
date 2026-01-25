import type { TagDto, TagType } from '../types/problem-api-types'

/**
 * Tag manipulation utilities specific to the problems feature.
 */

/**
 * Sorts problem tags by category priority (area, type, technique) and alphabetically within each group.
 * @param tags - Array of tag objects to sort
 * @param locale - Locale to use for alphabetical sorting (e.g., 'sk', 'en')
 * @returns A new array with tags sorted by category then alphabetically
 */
export const sortTagsByCategory = (tags: TagDto[], locale: string): TagDto[] => {
  // Define the sorting priority for tag types
  const tagTypePriority: Record<TagType, number> = {
    Area: 1,
    Type: 2,
    Goal: 3,
    Technique: 4,
  }

  // Sort tags first by category priority, then alphabetically by data within each category
  return [...tags].sort((firstTag, secondTag) => {
    const firstPriority = tagTypePriority[firstTag.tagType]
    const secondPriority = tagTypePriority[secondTag.tagType]

    // First compare by category priority
    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    // Within the same category, sort alphabetically by tag data
    return firstTag.displayName.localeCompare(secondTag.displayName, locale)
  })
}
