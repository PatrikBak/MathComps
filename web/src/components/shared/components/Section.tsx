import type { ReactNode } from 'react'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Color scheme for icon badges in a card grid.
 */
type CardColorScheme = {
  /** Tailwind text color class for the icon. */
  iconColor: string
  /** Tailwind gradient classes for the icon container background. */
  iconGradient: string
}

/**
 * Configuration for a card item in the {@link Section} card grid.
 */
type SectionCardItem = {
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
 * Props for the {@link Section} component.
 */
type SectionProps = {
  /** Optional anchor ID for scroll navigation */
  id?: string
  /** Optional badge element displayed above the title */
  badge?: ReactNode
  /** Section title - renders as h2. Optional when using custom children. */
  title?: ReactNode
  /** Optional description paragraph below the title */
  description?: ReactNode
  /** Optional additional className for the description */
  descriptionClassName?: string
  /** Optional cards stacked either horizontally or vertically - pass cards array to enable */
  cards?: SectionCardItem[]
  /** Optional footer content displayed below cards/children */
  footer?: ReactNode
  /** Custom content - use as alternative to cards prop */
  children?: ReactNode
  /** Container width variant - defaults to 'wide' */
  containerWidth?: 'narrow' | 'standard' | 'wide'
  /** Optional color schemes for the card grid icons — cycles through by index */
  cardColorSchemes?: CardColorScheme[]
  /** Optional additional className for the outer wrapper */
  className?: string
}

/**
 * Container width classes
 */
const CONTAINER_CLASSES = {
  narrow: 'max-w-md sm:max-w-2xl md:max-w-4xl mx-auto px-5',
  standard: 'max-w-4xl mx-auto px-4',
  wide: 'max-w-7xl mx-auto px-4',
}

/**
 * A unified section component for consistent page layout. Used
 * in pages with centering and glass card layouts, i.e. home or about pages.
 */
export default function Section({
  id,
  badge,
  title,
  description,
  descriptionClassName,
  cards,
  footer,
  children,
  containerWidth = 'wide',
  cardColorSchemes,
  className,
}: SectionProps) {
  return (
    <AnimatedSection className={cn('py-6 sm:py-10 md:py-14', className)} id={id}>
      <div className={CONTAINER_CLASSES[containerWidth]}>
        {/* Header container - only rendered when there's content */}
        {(badge || title || description) && (
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            {badge}
            {title && (
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-5 md:mb-6">
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  'text-muted text-sm sm:text-base md:text-lg max-w-4xl mx-auto leading-normal sm:leading-relaxed',
                  descriptionClassName
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}

        {/* Card grid - rendered if cards are provided */}
        {cards && cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8 max-w-xs sm:max-w-md md:max-w-4xl mx-auto">
            {cards.map((item, index) => {
              const colorScheme = cardColorSchemes?.[index % (cardColorSchemes.length || 1)]

              return (
                <GlassCard
                  key={index}
                  iconProps={{
                    icon: (
                      <item.iconComponent
                        size={20}
                        className={cn(
                          colorScheme?.iconColor ?? 'text-muted',
                          'sm:w-7 sm:h-7 lg:w-8 lg:h-8'
                        )}
                      />
                    ),
                    iconGradient: colorScheme?.iconGradient ?? '',
                  }}
                  title={item.title}
                  description={item.description}
                  href={item.href}
                />
              )
            })}
          </div>
        )}

        {/* Custom children content */}
        {children}

        {/* Footer */}
        {footer && (
          <div className="text-center mt-10 sm:mt-14 md:mt-24 text-sm text-muted max-w-xl mx-auto">
            {footer}
          </div>
        )}
      </div>
    </AnimatedSection>
  )
}
