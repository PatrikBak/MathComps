/**
 * Represents a single item in the table of contents.
 * Used by both desktop (TableOfContents) and mobile (MobileTableOfContents) components.
 */
export type TableOfContentsItem = {
  /** Unique identifier that matches a section's HTML id */
  id: string
  /** The section number for the navigation link, e.g. 1.2 */
  label: string
  /** Display text for the navigation link, without the number  */
  title: string
  /** Heading level (1-6) used for visual indentation */
  level: number
}

/**
 * Props for table of contents components (both desktop and mobile variants).
 */
export interface TableOfContentsProps {
  /** Array of table of contents items to display */
  items: TableOfContentsItem[]
}
