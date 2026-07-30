import type { useTranslations } from 'next-intl'

import {
  type Document,
  type EnvironmentBlock,
  type HandoutEnvironmentType,
  isEnvironmentBlock,
} from '@/components/features/handouts/handout-content-types'
import { SectionNumberingGenerator } from '@/components/shared/utils/section-numbering-utils'
import { slugify } from '@/components/shared/utils/string-utils'

/**
 * A translator bound to the handouts namespace.
 */
export type HandoutsTranslator = ReturnType<typeof useTranslations<'handouts'>>

/**
 * Builds the localized word naming each environment type, e.g. "Úloha" / "Theorem".
 *
 * @param t - Translator bound to the handouts namespace.
 *
 * @returns The label per environment type.
 */
export function buildEnvironmentLabels(
  t: HandoutsTranslator
): Record<HandoutEnvironmentType, string> {
  // One entry per type, so a new environment type fails to compile until it is named
  return {
    theorem: t('environments.theorem'),
    exercise: t('environments.exercise'),
    example: t('environments.example'),
    problem: t('environments.problem'),
    definition: t('environments.definition'),
  }
}

/**
 * Builds the DOM anchor id for a handout environment (a problem, theorem, ...) from the name its language gives
 * it: unlike a position-derived anchor, it survives reordering and retyping. Reading it never reveals more about
 * the environment than the page already shows.
 *
 * @param environmentSlug - The environment's name in the language being read.
 *
 * @returns The anchor id, e.g. `env-tower-of-hanoi`.
 */
export function buildEnvironmentAnchorId(environmentSlug: string): string {
  // The `env-` prefix namespaces it against the section-slug anchors on the same page, and guarantees a
  // leading letter so the anchor is a valid CSS selector whatever the name starts with
  return `env-${environmentSlug}`
}

/**
 * One environment of a document in reading order, paired with the document-wide per-type number the page
 * displays for it. The number is display only — identity is the block's id — but the counter rule lives here so
 * every caller computes the same number for a given environment. The block travels along rather than just its
 * id, so a caller rendering the document can look its number up by identity and never depend on ids being
 * distinct (a duplicate is the content validator's business, not the renderer's).
 */
export type DocumentEnvironment = {
  /** The environment block itself, as it sits in the document. */
  block: EnvironmentBlock
  /** The document-wide, per-type number the page displays for it. */
  number: number
}

/**
 * Lists every environment of a document in reading order, each carrying the number the page displays for it: a
 * per-type counter running across the whole document (not reset per section), pre-incremented at each environment.
 *
 * @param documentContent - The document to walk.
 *
 * @returns One entry per environment, in document order.
 */
export function listDocumentEnvironments(documentContent: Document): DocumentEnvironment[] {
  // Running counters per environment type — shared across the whole document, not reset per section
  const counters: Record<HandoutEnvironmentType, number> = {
    theorem: 0,
    exercise: 0,
    example: 0,
    problem: 0,
    definition: 0,
  }

  // Walk every section's blocks in order, keeping only the environments
  return documentContent.sections.flatMap((section) =>
    section.text.content.flatMap((block) => {
      // Skip anything that isn't a numbered environment
      if (!isEnvironmentBlock(block)) {
        return []
      }

      // Pre-increment claims the next number for this environment type
      const number = ++counters[block.type]

      // This environment, with the number just claimed
      return [{ block, number }]
    })
  )
}

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
