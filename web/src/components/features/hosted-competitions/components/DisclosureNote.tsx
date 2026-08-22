'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Props for the {@link DisclosureNote} component.
 */
type DisclosureNoteProps = {
  /** The mark it opens with. */
  icon: LucideIcon
  /** What it says, and the way to write in about it. */
  children: ReactNode
}

/**
 * An aside at the foot of one of the header's questions: something the answer above does not cover, and
 * the way to write in about it.
 */
export function DisclosureNote({ icon: Icon, children }: DisclosureNoteProps) {
  return (
    <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-foreground/[0.06] px-3.5 py-3 text-sm text-muted">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted/80" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
