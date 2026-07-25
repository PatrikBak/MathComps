import type { useTranslations } from 'next-intl'

import type { Document } from '@/components/features/handouts/handout-content-types'
import { SectionNumberingGenerator } from '@/components/shared/utils/section-numbering-utils'
import { slugify } from '@/components/shared/utils/string-utils'

import type { HandoutEnvironmentType } from './handout-content-types'

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
 * Builds the DOM anchor id for a handout environment (a problem, theorem, ...), from its type and its document-wide
 * per-type number. Both are language-independent, so a deep link to an environment holds in every locale.
 *
 * @param type - The environment's type.
 * @param environmentNumber - The environment's document-wide, per-type number.
 *
 * @returns The anchor id, e.g. `env-problem-4`.
 */
export function buildEnvAnchorId(
  type: HandoutEnvironmentType,
  environmentNumber: number | string
): string {
  // Namespaced by `env-` so it never collides with the section-slug anchors already on the page
  return `env-${type}-${environmentNumber}`
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
