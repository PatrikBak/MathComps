import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/** Style variants for {@link GuideText}. */
const guideTextVariants = cva('leading-relaxed hyphens-none', {
  variants: {
    variant: {
      // Body prose shares the one secondary-text color across the guide
      normal: 'text-base sm:text-lg text-muted-foreground',
      small: 'text-sm text-muted-foreground',
      // Acronym expansion
      acronym: 'text-sm italic text-muted',
    },
  },
  defaultVariants: {
    variant: 'normal',
  },
})

/**
 * Props for the {@link GuideText} component.
 */
type GuideTextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof guideTextVariants> & {
    /** Semantic HTML tag used to render the text. */
    as?: 'p' | 'div' | 'span'
  }

/**
 * Primary typography primitive for the guide feature.
 */
export function GuideText({
  as: Component = 'p',
  className,
  variant,
  children,
  ...props
}: GuideTextProps) {
  // Render the text in the chosen element
  return (
    <Component className={cn(guideTextVariants({ variant }), className)} {...props}>
      {children}
    </Component>
  )
}
