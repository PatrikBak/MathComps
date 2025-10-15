import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { SectionHeader, type SectionHeaderProps } from './SectionHeader'

/**
 * Props for the GuideSection component.
 * Extends SectionHeaderProps to reuse common header properties.
 */
interface GuideSectionProps extends Omit<SectionHeaderProps, 'title' | 'number'> {
  /** Unique identifier for the section */
  id: string
  /** Section numberer instance for hierarchical numbering */
  sectionNumberer: SectionNumberer
  /** Content to render inside the section */
  children: React.ReactNode
}

/**
 * Reusable guide section component that provides consistent structure and styling
 * for all guide sections. Handles section numbering using the SectionNumberer.
 */
export function GuideSection({
  id,
  description,
  icon,
  iconColor,
  iconBackground,
  sectionNumberer,
  children,
}: GuideSectionProps) {
  // Get the number+title for the section
  const sectionData = sectionNumberer.getSectionData(id)

  return (
    <AnimatedSection anchorId={id}>
      <section className="my-8 sm:my-16">
        <div className="max-w-7xl mx-auto px-0.5">
          <SectionHeader
            icon={icon}
            iconColor={iconColor}
            iconBackground={iconBackground}
            number={sectionData.number}
            title={sectionData.title}
            description={description}
          />
          {children}
        </div>
      </section>
    </AnimatedSection>
  )
}
