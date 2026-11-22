import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { PAGE_PANEL_CLASS } from './EmptyState'

/**
 * The props of {@link ResultsPlaceholder}.
 */
type ResultsPlaceholderProps = {
  /** The mark above the headline. */
  icon: LucideIcon
  /** The headline naming why there is nothing to show. */
  title: string
  /** The explanation under the headline. */
  hint: string
  /** What the reader can do about the missing answer, or what is already being done; none for a state that passes. */
  children?: ReactNode
}

/**
 * The panel standing in for a page's results while there is no answer to draw them from, in the same frame as the
 * panel for an empty list.
 */
export function ResultsPlaceholder({ icon: Icon, title, hint, children }: ResultsPlaceholderProps) {
  return (
    <div className={PAGE_PANEL_CLASS}>
      <Icon size={40} className="mb-3 text-muted" />
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {children}
    </div>
  )
}
