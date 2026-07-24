import { ChevronRight } from 'lucide-react'
import React from 'react'

import { CopyLinkButton } from '@/components/shared/components/CopyLinkButton'
import { cn } from '@/components/shared/utils/css-utils'

import { type BadgePaletteEntry, CARD_PALETTE, type HandoutEnvironmentType } from './handout-colors'

/**
 * Props for a single disclosure panel (proof / solution / hint) rendered
 * inside a {@link CollapsibleCard}.
 */
export type DisclosurePanelProps = {
  /** Translated label, e.g. "Proof", "Solution", "Hint". */
  label: string
  /** Tailwind text color class for the summary row. */
  textColorClass: string
  /** Badge palette data for the badge circle (small square / `✓)`. */
  badge: BadgePaletteEntry
  /** Content rendered inside the badge circle */
  badgeContent: React.ReactNode
  /** Panel body shown when expanded. */
  children: React.ReactNode
}

/**
 * A single disclosure panel rendered inside a {@link CollapsibleCard}.
 */
function DisclosurePanel({
  label,
  textColorClass,
  badge,
  badgeContent,
  children,
}: DisclosurePanelProps) {
  return (
    <details className="group">
      <summary
        className={cn(
          'ui-text flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-foreground/5 cursor-pointer [&::-webkit-details-marker]:hidden leading-6 font-medium',
          textColorClass
        )}
      >
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
            badge.bg,
            badge.text,
            badge.border
          )}
        >
          {badgeContent}
        </span>
        {label}
        <ChevronRight
          size={16}
          className="ml-auto opacity-70 transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-foreground/70">{children}</div>
    </details>
  )
}

/**
 * Props for the {@link CollapsibleCard} component.
 */
type CollapsibleCardProps = {
  /** Mathematical environment type, determines the color scheme. */
  type: HandoutEnvironmentType
  /** Heading label (e.g., "Theorem 1", "Exercise 3"). */
  title: React.ReactNode
  /** Optional badge next to the title (e.g. "Cauchy–Schwarz"). */
  subtitle?: React.ReactNode
  /** Body content of the environment (rendered math blocks, text, images). */
  children: React.ReactNode
  /** Collapsible panels (proof / solution / hints) shown after the body. */
  disclosures?: DisclosurePanelProps[]
  /** Unique anchor ID for deep linking (e.g., "theorem-1"). */
  id: string
  /** Optional control pinned to the trailing edge of the header row. */
  headerAction?: React.ReactNode
}

/**
 * A colored, collapsible card for mathematical environments (theorems, exercises, examples, problems).
 */
export function CollapsibleCard({
  type,
  title,
  subtitle,
  children,
  disclosures,
  id,
  headerAction,
}: CollapsibleCardProps) {
  // Resolve the color scheme for this environment type
  const card = CARD_PALETTE[type]

  return (
    <section
      id={id}
      className={cn('bg-surface/40 border-l-4 rounded-r-lg my-6 group', card.border)}
    >
      <div className="p-5 sm:p-6">
        {/* Header row with title, optional subtitle badge, and anchor link */}
        {(title || subtitle || id) && (
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {title && (
              <p
                className={cn(
                  'ui-text ui-nums font-semibold text-[1.06em] sm:text-[1.1em] leading-tight',
                  card.title
                )}
              >
                {title}
              </p>
            )}
            {subtitle && (
              <span
                className={cn(
                  'ui-text ui-nums border bg-foreground/5 text-[0.82em] sm:text-[0.86em] font-medium px-[0.6em] py-[0.28em] rounded-full inline-flex items-baseline leading-none',
                  card.title,
                  card.tint
                )}
              >
                {subtitle}
              </span>
            )}
            {id && <CopyLinkButton slug={id} iconSize={16} className="ml-0" />}
            {/* Trailing control, held in the UI typeface so it doesn't inherit the card's prose serif */}
            {headerAction && <div className="ml-auto ui-text">{headerAction}</div>}
          </div>
        )}
        {/* Card body content */}
        <div className="text-foreground/70 leading-relaxed">
          {children}
          {disclosures && disclosures.length > 0 && (
            <div className="mt-3 rounded-xl border border-foreground/10 divide-y divide-foreground/10 overflow-hidden">
              {disclosures.map((disclosure, index) => (
                <DisclosurePanel key={index} {...disclosure} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
