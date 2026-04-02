import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Styles for the guide card.
 */
const guideCardVariants = cva('rounded-lg border p-4 transition-colors sm:p-5 lg:p-6', {
  variants: {
    variant: {
      default: 'border-surface/50 bg-surface/10 hover:border-surface',
      large: 'border-surface/50 bg-gradient-to-br from-surface/20 to-surface/10',
      completion: cn('border-foreground/10', ACCENT_COLOR_MAP.emerald.bg),
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

/**
 * Props for the {@link GuideCard} component.
 */
type GuideCardProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof guideCardVariants> & {
    /** Optional destination URL. When provided, the card is clickable. */
    href?: string
  }

/**
 * Reusable surface component for guide content blocks.
 */
export function GuideCard({ className, children, variant, href, ...props }: GuideCardProps) {
  // Add 'block' to the classes if href is provided, so the card is clickable.
  const classes = cn(guideCardVariants({ variant }), href && 'block', className)

  // If href is provided, render the card as an AppLink so it's clickable.
  if (href) {
    return (
      <AppLink href={href} className={classes} {...props}>
        {children}
      </AppLink>
    )
  }

  // Otherwise, render the card as a regular article.
  return (
    <article className={classes} {...props}>
      {children}
    </article>
  )
}
