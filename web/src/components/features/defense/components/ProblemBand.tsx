'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ProblemBand}.
 */
type ProblemBandProps = {
  /** The problem statement as markdown/math source. */
  statement: string
}

/**
 * The problem statement above the conversation, at its own height up to a share of the panel. A statement
 * past that height scrolls, so what it costs the exchange is the same whatever problem is being argued.
 *
 * Folding it away costs a row only while it is folded, where the row is the whole of what is left to
 * unfold it by. Open, the control sits in a gutter of the statement's own space. It is one control either
 * way, so folding and unfolding leaves the keyboard where it was.
 */
export function ProblemBand({ statement }: ProblemBandProps) {
  // Defense copy
  const t = useTranslations('defense')

  // Whether the statement is showing
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="relative shrink-0 border-b border-foreground/10">
      {/* The statement, capped so a long one scrolls */}
      {isOpen && (
        <div className="scrollbar-visible max-h-[18dvh] overflow-y-auto overscroll-contain py-2.5 pl-4 pr-10 sm:pl-5">
          <div className="math-typography math-reference">
            <ProblemMarkdown content={statement} />
          </div>
        </div>
      )}

      {/* Fold the statement away, and bring it back. Open, it hangs in the gutter the statement leaves
          for it; folded, it is the row itself and carries the name of what it opens */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? t('problemStrip') : undefined}
        className={cn(
          'flex items-center gap-1.5 text-muted/60 hover:text-foreground',
          isOpen
            ? 'absolute right-2 top-1.5 size-6 justify-center sm:right-3'
            : 'w-full px-4 py-1.5 text-xs font-semibold text-muted sm:px-5'
        )}
      >
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown className="size-3.5" />}
        {!isOpen && t('problemStrip')}
      </button>
    </div>
  )
}
