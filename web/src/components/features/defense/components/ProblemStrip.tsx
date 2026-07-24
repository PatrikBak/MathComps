'use client'

import { ChevronRight } from 'lucide-react'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

/**
 * Props for the {@link ProblemStrip}.
 */
type ProblemStripProps = {
  /** The collapsible bar's label. */
  label: string
  /** The problem statement as markdown/math source. */
  statement: string
}

/**
 * A full-width, collapsible strip holding the problem statement, so the student can re-read what
 * they're defending without leaving the chat. Open by default.
 */
export function ProblemStrip({ label, statement }: ProblemStripProps) {
  return (
    <details open className="group border-b border-foreground/10">
      {/* The bar that toggles the statement */}
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-5 [&::-webkit-details-marker]:hidden">
        {/* Chevron rotates as the strip opens */}
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        {label}
      </summary>

      {/* The statement, revealed when the strip is open. The bottom padding mirrors the summary bar's,
          so the statement's own paragraph margins sit it evenly between label and edge */}
      <div className="px-4 pb-2.5 sm:px-5">
        <div className="math-typography">
          <RichMathEditorRenderer content={statement} lightImageBackground={false} />
        </div>
      </div>
    </details>
  )
}
