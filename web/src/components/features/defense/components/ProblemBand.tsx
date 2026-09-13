'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * How much of the surface the statement may take before it scrolls.
 */
type ProblemBandHeight =
  /** Something under the statement wants the same room, so the statement is held to a share of it. */
  | 'shared'
  /** The statement is the only thing on the surface wanting height, so it stands at its own. */
  | 'own'

/**
 * What each height lets the statement reach.
 */
const HEIGHT_CLASS: Record<ProblemBandHeight, string> = {
  shared: 'max-h-[18dvh]',
  own: 'max-h-none',
}

/**
 * Props for the {@link ProblemBand}.
 */
type ProblemBandProps = {
  /** The problem statement as markdown/math source. */
  statement: string
  /** The room the surface can spare the statement. */
  height: ProblemBandHeight
}

/**
 * The problem statement at the head of a surface, at its own height up to whatever the surface can spare.
 * A statement past that height scrolls, so what it costs everything under it is the same whatever problem
 * is being read.
 *
 * Folding it away costs a row only while it is folded, where the row is the whole of what is left to
 * unfold it by. Open, the control sits in a gutter of the statement's own space. It is one control either
 * way, so folding and unfolding leaves the keyboard where it was.
 */
export function ProblemBand({ statement, height }: ProblemBandProps) {
  // Defense copy
  const t = useTranslations('defense')

  // Whether the statement is showing
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="relative shrink-0 border-b border-foreground/10">
      {/* The statement, scrolling once it outgrows what the surface can spare it */}
      {isOpen && (
        <div
          className={cn(
            'scrollbar-visible overflow-y-auto overscroll-contain py-2.5 pr-10 pl-4 sm:pl-5',
            HEIGHT_CLASS[height]
          )}
        >
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
