import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * A linked entry whose whole row navigates to its `href`.
 */
type LinkEntry = {
  /** Discriminates a linked entry. */
  kind: 'link'
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
 * A non-interactive entry led by a small timing eyebrow, such as when the thing lands.
 */
type StaticEntry = {
  /** Discriminates a static entry. */
  kind: 'static'
  /** The entry's lead icon. */
  icon: LucideIcon
  /** The entry's heading. */
  title: string
  /** A one-line description under the title. */
  description: string
  /** Short timing note, e.g. when the thing lands. */
  meta: string
}

/**
 * Props for the {@link IndexEntry} component.
 */
export type IndexEntryProps = LinkEntry | StaticEntry

/**
 * The parts of an {@link IndexEntry}'s title row that vary by kind.
 */
type TitleRowVariant = {
  /** Flex layout classes for the row. */
  rowClass: string
  /** Color and hover treatment for the heading. */
  headingClass: string
  /** The element trailing the heading, such as a link's hover chevron. */
  trailing: ReactNode
}

/**
 * Resolves the kind-specific parts of the title row.
 */
function titleRowVariant(props: IndexEntryProps): TitleRowVariant {
  switch (props.kind) {
    // Linked: a chevron pinned right, and a heading that shifts to the accent color on hover
    case 'link':
      return {
        rowClass: 'flex items-center justify-between gap-3',
        headingClass:
          'text-foreground transition-colors group-hover:text-brand-light motion-reduce:transition-none',
        trailing: (
          <ArrowRight
            size={18}
            aria-hidden
            className="shrink-0 text-brand-light transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
          />
        ),
      }

    // Static: a muted heading, its timing note led as an eyebrow above
    case 'static':
      return {
        rowClass: 'flex items-center',
        headingClass: 'text-muted-foreground',
        trailing: null,
      }

    // Some other kind — the union grew and this switch didn't
    default:
      return assertNever(props)
  }
}

/**
 * The title row of an {@link IndexEntry}: a heading, then the kind-specific trailing element.
 */
function TitleRow(props: IndexEntryProps) {
  // The parts that vary by kind
  const { rowClass, headingClass, trailing } = titleRowVariant(props)

  // The heading's type scale is shared across kinds; only its color treatment varies
  return (
    <div className={rowClass}>
      <h3 className={cn('text-xl font-bold tracking-tight sm:text-2xl', headingClass)}>
        {props.title}
      </h3>
      {trailing}
    </div>
  )
}

/**
 * One line of the home page's typographic index: an inline icon, a bold title, and a description
 * beneath. Either a link or a static entry led by a timing eyebrow.
 */
export function IndexEntry(props: IndexEntryProps) {
  // The entry's lead icon component
  const Icon = props.icon

  // The two grid columns shared by both variants: the lead icon, then the title row above the description
  const columns = (
    <>
      {/* Inline lead icon in the brand accent, optically centered on the title line */}
      <Icon size={22} aria-hidden className="mt-1.5 shrink-0 text-brand-light" />

      {/* Title row above the description */}
      <div className="min-w-0">
        {/* Timing eyebrow */}
        {props.kind === 'static' && (
          <p className="mb-1 text-sm font-semibold text-brand-light">{props.meta}</p>
        )}
        <TitleRow {...props} />
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{props.description}</p>
      </div>
    </>
  )

  // The grid base both containers share; each kind adds its own element and interactions
  const gridClass = 'grid grid-cols-[auto_1fr] items-start gap-x-4'

  // Wrap the shared columns per kind: a navigable link, or a plain grid
  switch (props.kind) {
    // Linked entry: the whole row is a navigable link
    case 'link':
      return (
        <AppLink
          href={props.href}
          plain
          className={cn(
            'group',
            gridClass,
            'border-b border-foreground/10 px-4 py-6 transition-colors hover:bg-foreground/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'
          )}
        >
          {columns}
        </AppLink>
      )

    // Static entry: a plain, non-interactive grid
    case 'static':
      return <div className={gridClass}>{columns}</div>

    // Some other kind — the union grew and this switch didn't
    default:
      return assertNever(props)
  }
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
