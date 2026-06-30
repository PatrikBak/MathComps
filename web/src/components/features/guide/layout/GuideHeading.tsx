import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/** Size variants for the guide heading, keyed by semantic level. */
const guideHeadingVariants = cva(
  'font-bold tracking-tight text-balance hyphens-none text-foreground',
  {
    variants: {
      level: {
        h3: 'text-lg sm:text-xl',
        h4: 'text-base sm:text-lg',
      },
    },
    defaultVariants: {
      level: 'h3',
    },
  }
)

/**
 * Props for the {@link GuideHeading} component.
 */
type GuideHeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof guideHeadingVariants> & {
    /** Semantic heading level. */
    level?: 'h3' | 'h4'
  }

/**
 * Semantic heading primitive for guide sections and cards.
 */
export function GuideHeading({ className, level = 'h3', children, ...props }: GuideHeadingProps) {
  // The rendered tag matches the semantic level
  const Component = level

  // Render the heading element
  return (
    <Component className={cn(guideHeadingVariants({ level }), className)} {...props}>
      {children}
    </Component>
  )
}
