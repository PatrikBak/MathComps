import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Icon configuration for the {@link GlassCard} component
 */
type GlassCardIconProps = {
  /** Icon element to display */
  icon: ReactNode
  /** Tailwind gradient classes for icon background */
  iconGradient: string
  /** Custom glow color for the icon */
  glowColor?: string
}

/**
 * Props for the {@link GlassCard} component
 */
type GlassCardProps = {
  /** Card title content */
  title: ReactNode
  /** HTML element to use for the title */
  titleElement?: 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  /** Text alignment within the card */
  align?: 'left' | 'center'
  /** Icon configuration - {@link GlassCardIconProps} */
  iconProps?: GlassCardIconProps
  /** Description text displayed below the title */
  description?: ReactNode
  /** Additional content rendered at the bottom of the card */
  children?: ReactNode
  /** Optional href to make the card clickable - wraps content in {@link AppLink} */
  href?: string
}

/**
 * A mapping from the heading element to a Tailwind font-size class.
 */
const titleSizeClasses = {
  h1: 'text-2xl sm:text-4xl lg:text-5xl',
  h2: 'text-xl sm:text-3xl lg:text-4xl',
  h3: 'text-lg sm:text-2xl lg:text-3xl',
  h4: 'text-base sm:text-xl lg:text-2xl',
  div: 'text-base sm:text-xl lg:text-2xl',
}

/**
 * A reusable card component. Supports optional icons and can be made
 * clickable by providing an href.
 */
export default function GlassCard({
  title,
  iconProps,
  description,
  children,
  align = 'center',
  titleElement: TitleElement = 'h3',
  href,
}: GlassCardProps) {
  // The JSX content of the card
  const cardContent = (
    <>
      {iconProps && (
        <div
          className={cn(
            'p-2.5 sm:p-4 rounded-xl sm:rounded-2xl inline-block mb-3 sm:mb-6 mx-auto',
            iconProps.iconGradient && `bg-gradient-to-br ${iconProps.iconGradient}`
          )}
          style={
            iconProps.glowColor == null
              ? undefined
              : { filter: `drop-shadow(0 0 5px ${iconProps.glowColor})` }
          }
        >
          {iconProps.icon}
        </div>
      )}
      <TitleElement
        className={cn('font-bold text-white mb-2 sm:mb-4', titleSizeClasses[TitleElement])}
      >
        {title}
      </TitleElement>
      {description && (
        <div className="text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed mb-3 sm:mb-6">
          {description}
        </div>
      )}
      {children && <div className="mt-2 sm:mt-4">{children}</div>}
    </>
  )

  // Common card styles used for both clickable and non-clickable cards
  const cardClassName = cn(
    'relative overflow-hidden bg-slate-800/40 backdrop-blur-md border border-violet-500/20 p-2 sm:p-4 lg:p-6 rounded-2xl group hover:scale-105 transition-all duration-500',
    align === 'center' && 'text-center'
  )

  // If href is provided, wrap the card in an AppLink
  if (href) {
    return (
      <AppLink href={href} className={cn(cardClassName, 'block no-underline')}>
        {cardContent}
      </AppLink>
    )
  }

  // Otherwise, render as a regular div
  return <div className={cardClassName}>{cardContent}</div>
}
