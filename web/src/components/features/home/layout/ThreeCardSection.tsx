import type { ReactNode } from 'react'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

interface CardItem {
  iconComponent: React.ElementType
  title: string
  description: ReactNode
}

interface ThreeCardSectionProps {
  headerContent: React.ReactNode
  cards: CardItem[]
  footer?: React.ReactNode
  id?: string
}

export default function ThreeCardSection({
  headerContent,
  cards,
  footer,
  id,
}: ThreeCardSectionProps) {
  const colorSchemes = [
    {
      iconColor: 'text-indigo-300',
      iconGradient: 'from-indigo-600/30 to-purple-600/30',
    },
    {
      iconColor: 'text-violet-300',
      iconGradient: 'from-violet-600/30 to-pink-600/30',
    },
    {
      iconColor: 'text-pink-300',
      iconGradient: 'from-pink-600/30 to-rose-600/30',
    },
  ]

  return (
    <AnimatedSection className={HOME_ABOUT_STYLES.sectionWrapper} anchorId={id}>
      <section id={id}>
        <div className={HOME_ABOUT_STYLES.containerWide}>
          <div className={HOME_ABOUT_STYLES.headerContainer}>{headerContent}</div>

          <div className={HOME_ABOUT_STYLES.threeCardGrid}>
            {cards.map((item, index) => {
              // Select the color scheme based on the card's index.
              const colorScheme = colorSchemes[index % colorSchemes.length]
              const Icon = item.iconComponent

              return (
                <GlassCard
                  key={index}
                  iconProps={{
                    icon: (
                      <Icon
                        size={20}
                        className={cn(colorScheme.iconColor, 'sm:w-7 sm:h-7 lg:w-8 lg:h-8')}
                      />
                    ),
                    iconGradient: colorScheme.iconGradient,
                  }}
                  title={item.title}
                  description={item.description}
                />
              )
            })}
          </div>

          {footer && <div className={HOME_ABOUT_STYLES.sectionFooter}>{footer}</div>}
        </div>
      </section>
    </AnimatedSection>
  )
}
