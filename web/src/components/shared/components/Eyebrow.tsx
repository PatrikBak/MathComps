import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The small uppercase letterspaced label used as a category tag or section kicker. Color is left
 * to the caller's {@link EyebrowProps.className} so each context keeps its own hue.
 */
const eyebrowVariants = cva('inline-block uppercase font-semibold tracking-wider', {
  variants: {
    size: {
      sm: 'text-[11px]',
      md: 'text-xs',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

/**
 * Props for the {@link Eyebrow} component.
 */
export type EyebrowProps = VariantProps<typeof eyebrowVariants> & {
  /** The label text. */
  children: ReactNode
  /** When set, the eyebrow becomes a link to this destination (e.g. a category filter). */
  href?: string
  /** Color/spacing overrides for the specific context. */
  className?: string
}

/**
 * A category/kicker label. Plain text by default; pass {@link EyebrowProps.href} to make it a link,
 * which then gets a focus ring and an enlarged hit area so the small label still clears the minimum
 * touch-target size.
 */
export function Eyebrow({ children, href, size, className }: EyebrowProps) {
  // Plain label: just the styled text
  if (href === undefined) {
    return <span className={cn(eyebrowVariants({ size }), className)}>{children}</span>
  }

  // Link: `plain` keeps AppLink from touching the color, so the category hue holds and only dims
  // via opacity on hover; plus a focus ring and a tap area grown without shifting layout
  return (
    <AppLink
      plain
      href={href}
      className={cn(
        eyebrowVariants({ size }),
        'rounded px-1 py-1 -mx-1 -my-1 hover:opacity-80 transition-opacity',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        className
      )}
    >
      {children}
    </AppLink>
  )
}
