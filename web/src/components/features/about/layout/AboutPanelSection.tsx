import type { ReactNode } from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GlassCard from '@/components/shared/components/GlassCard'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

type AboutSectionProps = {
  id: string
  title: string
  description?: ReactNode
  children?: ReactNode
}

export default function AboutPanelSection({ id, title, description, children }: AboutSectionProps) {
  return (
    <AnimatedSection className={HOME_ABOUT_STYLES.sectionWrapper} anchorId={id}>
      <section id={id}>
        <div className={HOME_ABOUT_STYLES.containerStandard}>
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
        </div>
      </section>
    </AnimatedSection>
  )
}
