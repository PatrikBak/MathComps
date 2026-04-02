import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * The styles for the guide heading.
 */
const guideHeadingVariants = cva('font-bold tracking-tight', {
  variants: {
    level: {
      h1: 'text-3xl sm:text-4xl',
      h2: 'text-2xl sm:text-3xl',
      h3: 'text-lg sm:text-xl',
      h4: 'text-base sm:text-lg',
    },
    color: {
      foreground: 'text-foreground',
      brand: 'text-brand-light',
    },
  },
  defaultVariants: {
    level: 'h3',
    color: 'foreground',
  },
})

/**
 * Props for the {@link GuideHeading} component.
 */
type GuideHeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof guideHeadingVariants> & {
    /** Semantic heading level used for the rendered element and size mapping. */
    level?: 'h1' | 'h2' | 'h3' | 'h4'
  }

/**
 * Semantic heading primitive for guide sections and cards.
 */
export function GuideHeading({
  className,
  level = 'h3',
  color,
  children,
  ...props
}: GuideHeadingProps) {
  const Component = level

  return (
    <Component className={cn(guideHeadingVariants({ level, color }), className)} {...props}>
      {children}
    </Component>
  )
}
