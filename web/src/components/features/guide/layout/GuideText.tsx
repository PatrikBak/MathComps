import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Styles for the guide text.
 */
const guideTextVariants = cva('leading-relaxed', {
  variants: {
    variant: {
      normal: 'text-base sm:text-lg',
      small: 'text-sm sm:text-base',
      acronym: 'text-sm italic',
    },
    color: {
      subtle: 'text-foreground/70',
      muted: 'text-muted',
    },
  },
  compoundVariants: [
    {
      variant: 'acronym',
      color: 'subtle',
      className: 'text-muted',
    },
  ],
  defaultVariants: {
    variant: 'normal',
    color: 'subtle',
  },
})

/**
 * Props for the {@link GuideText} component.
 */
type GuideTextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof guideTextVariants> & {
    /* Semantic HTML tag used to render the text. */
    as?: 'p' | 'span' | 'div'
  }

/**
 * Primary typography primitive for the guide feature.
 */
export function GuideText({
  as: Component = 'p',
  className,
  variant,
  color,
  children,
  ...props
}: GuideTextProps) {
  return (
    <Component className={cn(guideTextVariants({ variant, color }), className)} {...props}>
      {children}
    </Component>
  )
}
