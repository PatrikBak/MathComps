import type { TagDto, TagType } from '../types/problem-api-types'

/**
 * Tag manipulation utilities specific to the problems feature.
 */

/**
 * Sorts problem tags by category priority (area, type, technique) and alphabetically within each group.
 * @param tags - Array of tag objects to sort
 * @returns A new array with tags sorted by category then alphabetically
 */
export const sortTagsByCategory = (tags: TagDto[]): TagDto[] => {
  // Define the sorting priority for tag types
  const tagTypePriority: Record<TagType, number> = {
    Area: 1,
    Type: 2,
    Technique: 3,
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
    return firstTag.displayName.localeCompare(secondTag.displayName, 'sk', { sensitivity: 'base' })
  })
}
