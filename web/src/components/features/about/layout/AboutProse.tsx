import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link AboutProse} component.
 */
type AboutProseProps = {
  /** Extra classes for paragraph spacing. */
  className?: string
  /** The paragraphs. */
  children: ReactNode
}

/**
 * The reading type shared by the about page's narrative beats.
 */
export function AboutProse({ className, children }: AboutProseProps) {
  return (
    <div
      className={cn(
        'text-base sm:text-lg leading-relaxed text-muted-foreground hyphens-none',
        className
      )}
    >
      {children}
    </div>
  )
}
