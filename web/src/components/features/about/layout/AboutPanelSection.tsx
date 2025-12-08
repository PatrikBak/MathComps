import type { ReactNode } from 'react'

import GlassCard from '@/components/shared/components/GlassCard'
import Section from '@/components/shared/components/Section'

/**
 * Props for the {@link AboutPanelSection} component.
 */
type AboutPanelSectionProps = {
  /* The ID of the section */
  id: string
  /* The title of the section */
  title: string
  /* The description of the section */
  description?: ReactNode
  /* The children of the section */
  children?: ReactNode
}

/**
 * A panel section used on the about page with a {@link GlassCard} wrapper.
 */
export default function AboutPanelSection({
  id,
  title,
  description,
  children,
}: AboutPanelSectionProps) {
  return (
    <Section id={id} containerWidth="standard">
      <GlassCard
        title={title}
        titleElement="h3"
        description={
          description ?? (
            <div className="text-slate-300 text-base sm:text-lg leading-relaxed space-y-5">
              {description}
            </div>
          )
        }
        align="left"
      >
        {children}
      </GlassCard>
    </Section>
  )
}
