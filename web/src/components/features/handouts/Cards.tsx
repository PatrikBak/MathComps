import React from 'react'

import { CopyLinkButton } from '@/components/shared/components/CopyLinkButton'
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
  /** Optional badge next to the title (e.g. "Cauchy–Schwarz"). */
  subtitle?: React.ReactNode
  /** Body content of the environment (rendered math blocks, text, images). */
  children: React.ReactNode
  /** Label for the built-in collapsible section (e.g., "Proof", "Solution"). */
  detailsTitle?: string
  /** Content revealed when the built-in collapsible section is expanded. */
  details?: React.ReactNode
  /** Unique anchor ID for deep linking (e.g., "theorem-1"). */
  id: string
}

/**
 * A colored, collapsible card for mathematical environments
 * (theorems, exercises, examples, problems).
 */
export function CollapsibleCard({
  type,
  title,
  subtitle,
  children,
  detailsTitle,
  details,
  id,
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
          </div>
        )}
        {/* Card body content */}
        <div className="text-foreground/70 leading-relaxed">{children}</div>
      </div>

      {/* Collapsible details section (e.g., proof or solution) */}
      {(detailsTitle || details) && (
        <details className={cn('border-t group', card.tint)}>
          <summary
            className={cn(
              'flex justify-between items-center px-5 sm:px-6 py-3 sm:py-4 hover:bg-foreground/5',
              card.summary
            )}
          >
            <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
              {detailsTitle}
            </span>{' '}
            <svg
              className="w-5 h-5 transition-transform group-open:rotate-90"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <div className="p-5 sm:p-6 border-t text-foreground/70 leading-relaxed">
            {details ? details : <em className="text-muted-foreground">—</em>}
          </div>
        </details>
      )}
    </section>
  )
}
