import type { TableOfContentsItem } from '@/components/table-of-contents/table-of-contents-types'

/**
 * Represents a section with its hierarchical number and title
 * (used for lookup and display in the table of contents).
 */
type SectionData = {
  /** The section number with potential dots, e.g. 1.2 */
  number: string
  /** The section title without the number */
  title: string
}

/**
 * Simple helper class that takes navigation items and provides title lookup by ID.
 */
export class SectionNumberer {
  /**
   * Pre-cache map from ids to section data
   */
  private titleMap: Map<string, SectionData>

  /**
   * Construct the section numberer and populate the map of section IDs
   *
   * @param navigationItems - Array of table of contents items, each containing an id, label (number), and title
   */
  constructor(navigationItems: TableOfContentsItem[]) {
    // Build the titleMap: id => { number, title }, using separate label and title fields
    this.titleMap = new Map(
      navigationItems.map((item) => {
        // Use label as section number and title as section title directly
        return [item.id, { number: item.label, title: item.title }]
      })
    )
  }

  /**
   * Get the section data (number and title) for a section by ID.
   *
   * @param id - Section identifier
   *
   * @returns SectionData object with number and title
   */
  getSectionData(id: string): SectionData {
    const sectionData = this.titleMap.get(id)
    if (!sectionData) {
      throw new Error(`Section with ID "${id}" not found in navigation items`)
    }
    return sectionData
  }
}
