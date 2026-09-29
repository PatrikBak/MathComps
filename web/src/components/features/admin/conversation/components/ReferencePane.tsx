'use client'

import { useTranslations } from 'next-intl'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'
import type { ImageContext } from '@/components/shared/utils/media-utils'

/**
 * Props for the {@link ReferencePane} component.
 */
type ReferencePaneProps = {
  /** The problem as the student saw it. */
  statement: string
  /** The solution the conversation is judged against. */
  reference: string
  /** Whether the transcript stands beside this pane, carrying the statement in its own band. */
  isSplit: boolean
  /** Where the images the statement and the solution name are kept. */
  imageContext: ImageContext
}

/**
 * The classes each part of the pane is labelled in, set quieter than any heading in the solution under it.
 */
const SECTION_LABEL_CLASS = 'mb-2 text-[11px] font-bold uppercase tracking-wide text-muted'

/**
 * The solution a conversation is judged against. It names itself and takes focus, since a pane that only
 * scrolls is otherwise out of reach from the keyboard and a long solution ends where the viewport does.
 */
export function ReferencePane({ statement, reference, isSplit, imageContext }: ReferencePaneProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={t('tabs.reference')}
      className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
    >
      {/* The statement, only where the transcript's own band isn't already showing it */}
      {!isSplit && (
        <>
          {/* Section label */}
          <h3 className={SECTION_LABEL_CLASS}>{t('reference.statement')}</h3>

          {/* The statement itself */}
          <div className="math-typography math-reference">
            <RichMathEditorRenderer content={statement} imageContext={imageContext} />
          </div>
        </>
      )}

      {/* Section label */}
      <h3 className={cn(SECTION_LABEL_CLASS, !isSplit && 'mt-6')}>{t('reference.solution')}</h3>

      {/* The solution itself */}
      <div className="math-typography math-reference">
        <RichMathEditorRenderer content={reference} imageContext={imageContext} />
      </div>
    </div>
  )
}
