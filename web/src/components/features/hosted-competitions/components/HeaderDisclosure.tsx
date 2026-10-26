'use client'

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link HeaderDisclosure} component.
 */
type HeaderDisclosureProps = {
  /** What the row reads while folded, and what the reader clicks to unfold it. */
  label: string
  /** What unfolds under the row. */
  children: ReactNode
}

/**
 * One row in the page header, folded away until somebody opens it.
 *
 * A native disclosure, so it works before any script does.
 */
export function HeaderDisclosure({ label, children }: HeaderDisclosureProps) {
  return (
    <details className="group open:pb-3">
      <summary
        className={cn(
          'inline-flex items-center gap-1 rounded text-sm text-link hover:text-link-hover hover:underline',
          FOCUS_RING_CLASS,
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden'
        )}
      >
        <ChevronRight
          size={15}
          className="transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
        />
        {label}
      </summary>

      <div className="mt-3">{children}</div>
    </details>
  )
}
