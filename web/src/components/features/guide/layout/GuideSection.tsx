import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { slugify } from '@/components/shared/utils/string-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { SectionHeader, type SectionHeaderProps } from './SectionHeader'

/**
 * Props for the {@link GuideSection} component.
 */
type GuideSectionProps = Omit<SectionHeaderProps, 'title' | 'number' | 'sectionSlug'> & {
  /** Section title */
  title: string
  /** Section numberer instance for hierarchical numbering */
  sectionNumberer: SectionNumberer
  /** Content to render inside the section */
  children: React.ReactNode
}

/**
 * Reusable guide section component.
 */
export function GuideSection({
  title,
  description,
  icon,
  accent,
  sectionNumberer,
  children,
}: GuideSectionProps) {
  // Generate slug from title
  const slug = slugify(title)

  // Get the section number from the numberer
  const sectionData = sectionNumberer.getSectionData(slug)

  return (
    <AnimatedSection id={slug}>
      <section className="my-8 sm:my-16">
        <div className="max-w-7xl mx-auto px-0.5">
          <SectionHeader
            icon={icon}
            accent={accent}
            number={sectionData.number}
            title={sectionData.title}
            description={description}
            sectionSlug={slug}
          />
          {children}
        </div>
      </section>
    </AnimatedSection>
  )
}
