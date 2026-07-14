import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link PageHeader} component.
 */
type PageHeaderProps = {
  /** The page title. */
  title: ReactNode
  /** Optional intro prose. */
  children?: ReactNode
  /** Extra classes. */
  className?: string
}

/**
 * The title header shared by the site's plain content pages: a canonical h1 over an optional block
 * of intro prose.
 */
export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 sm:mb-10', className)}>
      {/* Page title */}
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>

      {/* Intro prose, when supplied */}
      {children && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/70 sm:text-base">
          {children}
        </div>
      )}
    </header>
  )
}
