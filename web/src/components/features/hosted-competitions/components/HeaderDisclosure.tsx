'use client'

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The look of one row in the page header.
 */
export const HEADER_ROW_CLASS = cn(
  'inline-flex items-center gap-1 rounded text-sm text-link hover:text-link-hover hover:underline',
  FOCUS_RING_CLASS
)

/**
 * Props for the {@link HeaderDisclosure} component.
 */
type HeaderDisclosureProps = {
  /** The question it answers, which is what the reader clicks. */
  label: string
  /** The answer. */
  children: ReactNode
}

/**
 * One question in the page header, folded away until somebody asks it.
 *
 * Labelled with the question rather than the topic, and native, so it works before any script does.
 */
export function HeaderDisclosure({ label, children }: HeaderDisclosureProps) {
  return (
    <details className="group open:pb-3">
      <summary
        className={cn(
          HEADER_ROW_CLASS,
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
