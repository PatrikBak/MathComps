import type { Document } from '@/components/features/handouts/types/handout-types'
import { SectionNumberingGenerator } from '@/components/shared/utils/section-numbering-utils'
import { slugify } from '@/components/shared/utils/string-utils'

/**
 * Metadata for a section, used for both TOC and rendering.
 */
export type SectionMetadata = {
  /** The unique ID for the section, used for anchor links */
  id: string
  /** The section number, e.g. "1.2.3" */
  label: string
  /** The section title */
  title: string
  /** The section level (1 for \sec, 2 for \secc) */
  level: number
  /** The index of the section in the document */
  sectionIndex: number
}

/**
 * Compute section metadata (ID, numbering, level) for both TOC and rendering.
 */
export function computeSectionMetadata(documentContent: Document): Array<SectionMetadata> {
  // Use the shared numbering generator
  const numbering = new SectionNumberingGenerator()

  // Compute metadata for each section
  return documentContent.sections.map((section, index) => {
    // Ensure section level is at least 1 for valid header hierarchy
    const headerLevel = Math.max(1, section.level)

    // Generate section number using the shared utility (convert to 0-indexed)
    const sectionNumber = numbering.getNextNumber(headerLevel - 1)

    // Generate unique ID from section title for anchor links
    const sectionId = slugify(section.title)

    // Return the computed metadata
    return {
      id: sectionId,
      label: sectionNumber,
      title: section.title,
      level: headerLevel,
      sectionIndex: index,
    }
  })
}
