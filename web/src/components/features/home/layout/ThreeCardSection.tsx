import type { ReactNode } from 'react'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

/**
 * Card item configuration for the {@link ThreeCardSection} component
 */
type CardItem = {
  /** Icon component to display */
  iconComponent: React.ElementType
  /** Title of the card */
  title: string
  /** Description of the card */
  description: ReactNode
  /** Optional link to make the card clickable */
  href?: string
}

/**
 * Props for the {@link ThreeCardSection} component
 */
type ThreeCardSectionProps = {
  /** Header content displayed above the cards */
  headerContent: React.ReactNode
  /** Array of {@link CardItem} to display */
  cards: CardItem[]
  /** Optional footer content displayed below the cards */
  footer?: React.ReactNode
  /** Optional anchor ID for scroll navigation */
  id?: string
}

/**
 * A reusable section component that displays three cards in a grid layout.
 * Each card can optionally be clickable by providing an href.
 * Uses {@link GlassCard} for rendering individual cards.
 */
export default function ThreeCardSection({
  headerContent,
  cards,
  footer,
  id,
}: ThreeCardSectionProps) {
  // Define color schemes for the three cards
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
      <div className={HOME_ABOUT_STYLES.containerWide}>
        <div className={HOME_ABOUT_STYLES.headerContainer}>{headerContent}</div>

        <div className={HOME_ABOUT_STYLES.threeCardGrid}>
          {cards.map((item, index) => {
            // Select the color scheme based on the card's index
            const colorScheme = colorSchemes[index % colorSchemes.length]

            return (
              <GlassCard
                key={index}
                iconProps={{
                  icon: (
                    <item.iconComponent
                      size={20}
                      className={cn(colorScheme.iconColor, 'sm:w-7 sm:h-7 lg:w-8 lg:h-8')}
                    />
                  ),
                  iconGradient: colorScheme.iconGradient,
                }}
                title={item.title}
                description={item.description}
                href={item.href}
              />
            )
          })}
        </div>

        {footer && <div className={HOME_ABOUT_STYLES.sectionFooter}>{footer}</div>}
      </div>
    </AnimatedSection>
  )
}
