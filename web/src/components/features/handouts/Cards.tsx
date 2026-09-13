import React from 'react'

import { CopyLinkButton } from '@/components/shared/components/CopyLinkButton'
import {
  DisclosurePanel,
  type DisclosurePanelProps,
} from '@/components/shared/components/DisclosurePanel'
import { cn } from '@/components/shared/utils/css-utils'

import { CARD_PALETTE, type HandoutEnvironmentType } from './handout-colors'

/**
 * Props for the {@link CollapsibleCard} component.
 */
type CollapsibleCardProps = {
  /** Mathematical environment type, determines the color scheme. */
  type: HandoutEnvironmentType
  /** Heading label (e.g., "Theorem 1", "Exercise 3"). */
  title: React.ReactNode
  /** Optional name the author gave the environment (e.g. "Cauchy–Schwarz"). */
  subtitle?: React.ReactNode
  /** Body content of the environment (rendered math blocks, text, images). */
  children: React.ReactNode
  /** Collapsible panels (proof / solution / hints) shown after the body. */
  disclosures?: DisclosurePanelProps[]
  /** Unique anchor ID for deep linking (e.g., "theorem-1"). */
  id: string
  /** Optional control shown in the header's trailing corner. */
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
        {/* Header. The controls float out of normal flow, so a heading too long to sit beside them
            wraps beneath and reclaims the card's full width. No breakpoint can stand in for the
            float here: where the heading gives way depends on how long the author's subtitle runs,
            not on how wide the card is. */}
        {(title || subtitle || id) && (
          <div className="mb-2 flow-root">
            {/* The card's controls, held in the UI typeface so they don't inherit its prose serif */}
            {(headerAction || id) && (
              <div className="float-right ml-3 flex items-center gap-1 ui-text">
                {id && <CopyLinkButton slug={id} iconSize={16} className="ml-0" />}
                {headerAction}
              </div>
            )}
            {/* Label and the author's name for the environment, run together as one phrase, the
                way the printed handout sets it */}
            <span className={cn('ui-text ui-nums leading-snug', card.title)}>
              {title && (
                <span
                  className={cn(
                    'font-semibold text-[1.06em] sm:text-[1.1em]',
                    // The label is always on the first line, so the leading that matches the
                    // tallest control belongs here and a name wrapped below keeps its own
                    headerAction ? 'leading-9' : 'leading-7'
                  )}
                >
                  {title}
                </span>
              )}
              {/* An atomic box, so a name that doesn't fit beside the controls drops whole to the
                  next line and breaks only once it has that line to itself */}
              {subtitle && (
                <>
                  {' '}
                  <span className="inline-block max-w-full text-[0.95em] sm:text-[1em]">
                    ({subtitle})
                  </span>
                </>
              )}
            </span>
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
