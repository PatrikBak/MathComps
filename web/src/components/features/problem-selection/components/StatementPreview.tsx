'use client'

import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { ScaledContent } from '@/components/shared/components/ScaledContent'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'

import type { Proposal } from '../model/selection-types'
import { ProposalStatement } from './ProposalStatement'

/**
 * Props for the {@link StatementPreview} component.
 */
type StatementPreviewProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
  /** What the trigger shows in place of the page icon, naming the trigger too. */
  children?: ReactNode
}

/**
 * The page icon set before a problem's name, or the text given in its place, showing the problem's whole statement in
 * small type while hovered, focused or pressed, so a list or a comment naming the problem need not be left to recall
 * it.
 */
export function StatementPreview({ proposal, language, children }: StatementPreviewProps) {
  // Copy for the statement
  const t = useTranslations('problemSelection.text')

  return (
    <Tooltip
      placement="bottom-start"
      // The screen's width, which the tooltip caps at its widest: a definite width for the scaled statement
      className="w-screen"
      content={
        // The statement as its own page sets it, drawn smaller whole, math, gaps and figures alike
        <ScaledContent scale={0.8}>
          <ProposalStatement proposal={proposal} language={language} />
        </ScaledContent>
      }
    >
      {/* The trigger, the page icon unless text is given in its place */}
      {children === undefined ? (
        // The page icon
        <button
          type="button"
          aria-label={t('preview')}
          className={cn(
            'inline-flex shrink-0 rounded-md p-0.5 align-middle text-muted transition-colors hover:text-foreground',
            FOCUS_RING_CLASS
          )}
        >
          <FileText size={14} aria-hidden />
        </button>
      ) : (
        // The text given, which names the button
        <button
          type="button"
          className={cn(
            'rounded-sm font-medium text-brand-light transition-colors hover:text-foreground',
            FOCUS_RING_CLASS
          )}
        >
          {children}
        </button>
      )}
    </Tooltip>
  )
}
