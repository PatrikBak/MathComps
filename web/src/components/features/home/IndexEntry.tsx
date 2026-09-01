import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link IndexEntry} component.
 */
export type IndexEntryProps = {
  /** The entry's lead icon. */
  icon: LucideIcon
  /** The entry's heading. */
  title: string
  /** A one-line description under the title. */
  description: string
  /** The route the whole entry links to. */
  href: string
}

/**
 * One line of the home page's typographic index: an inline icon, a bold title, and a description
 * beneath, the whole row navigating to its route.
 */
export function IndexEntry({ icon: Icon, title, description, href }: IndexEntryProps) {
  return (
    <AppLink
      href={href}
      plain
      className="group grid grid-cols-[auto_1fr] items-start gap-x-4 border-b border-foreground/10 px-4 py-6 transition-colors hover:bg-foreground/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
    >
      {/* Inline lead icon in the brand accent, optically centered on the title line */}
      <Icon size={22} aria-hidden className="mt-1.5 shrink-0 text-brand-light" />

      {/* Title row above the description */}
      <div className="min-w-0">
        {/* Heading, with the chevron pinned to the right of the row */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-brand-light motion-reduce:transition-none sm:text-2xl">
            {title}
          </h3>
          <ArrowRight
            size={18}
            aria-hidden
            className="shrink-0 text-brand-light transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </div>

        {/* Description */}
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
      </div>
    </AppLink>
  )
}

/**
 * Props for the {@link IndexList} component.
 */
type IndexListProps = {
  /** `ul` for a list; `div` for a single entry. */
  as?: 'ul' | 'div'
  /** Extra classes merged after the shared bleed-and-rule recipe. */
  className?: string
  /** The entries. */
  children: ReactNode
}

/**
 * The hairline rule a section's {@link IndexEntry} rows sit under, bled past the section's own
 * padding so each row's hover wash and icon reach the true edge.
 */
export function IndexList({ as = 'div', className, children }: IndexListProps) {
  // Element type is caller-chosen; the bleed-and-rule recipe is shared
  const Wrapper = as

  return (
    <Wrapper className={cn('-mx-4 border-t border-foreground/10', className)}>{children}</Wrapper>
  )
}
