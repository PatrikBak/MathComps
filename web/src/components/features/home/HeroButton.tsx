import { cva, type VariantProps } from 'class-variance-authority'
import type { ElementType } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

import { HERO_GRADIENTS } from './home-colors'

/**
 * Gradient button styles for the hero section CTA buttons.
 * Each variant is a unique gradient paired with semantic border and ring tokens.
 */
const heroButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 md:gap-3 rounded-lg font-semibold text-brand-foreground transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-focus whitespace-nowrap w-full max-w-[240px] md:max-w-[300px] text-sm md:text-xl px-4 py-2 md:px-6 md:py-3',
  {
    variants: {
      variant: HERO_GRADIENTS,
    },
  }
)

/**
 * Props for the {@link HeroButton} component.
 */
type HeroButtonProps = VariantProps<typeof heroButtonVariants> & {
  /** Destination URL for the link. */
  href: string
  /** Lucide icon component displayed before the label. */
  icon: ElementType
  /** Button label text. */
  children: React.ReactNode
  /** Additional CSS classes. */
  className?: string
}

/**
 * Gradient CTA button used exclusively in the landing page hero section.
 * Renders as a localized {@link AppLink} with an icon and gradient background.
 */
export function HeroButton({ href, icon: Icon, variant, className, children }: HeroButtonProps) {
  return (
    <AppLink href={href} className={cn(heroButtonVariants({ variant }), className)}>
      <Icon className="w-4 h-4 md:w-5 md:h-5" />
      {children}
    </AppLink>
  )
}
