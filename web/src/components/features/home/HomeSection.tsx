import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link HomeSection} component.
 */
type HomeSectionProps = {
  /** Anchor id for the section. */
  id?: string
  /** Extra classes merged after the shared width and rhythm. */
  className?: string
  /** The section's content. */
  children: ReactNode
}

/**
 * The shared width and vertical rhythm every home-page section sits in.
 */
export function HomeSection({ id, className, children }: HomeSectionProps) {
  return (
    <section id={id} className={cn('mx-auto max-w-4xl py-5 sm:py-7', className)}>
      {children}
    </section>
  )
}

/**
 * Props for the {@link SectionHeading} component.
 */
type SectionHeadingProps = {
  /** Extra classes merged after the shared heading style. */
  className?: string
  /** The heading text. */
  children: ReactNode
}

/**
 * The heading style shared by every home-page section.
 */
export function SectionHeading({ className, children }: SectionHeadingProps) {
  return (
    <h2 className={cn('text-xl font-bold tracking-tight text-foreground sm:text-2xl', className)}>
      {children}
    </h2>
  )
}
