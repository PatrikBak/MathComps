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
  /** Whether the transcript stands beside this pane, carrying the statement in its own strip. */
  isSplit: boolean
  /** Where the images the statement and the solution name are kept. */
  imageContext: ImageContext
}

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
      className="math-typography flex-1 overflow-y-auto overscroll-contain px-5 py-4"
    >
      {/* The statement, only where the transcript's own strip isn't already showing it */}
      {!isSplit && (
        <>
          {/* Section heading */}
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('reference.statement')}</h3>

          {/* The statement itself */}
          <RichMathEditorRenderer
            content={statement}
            lightImageBackground={false}
            imageContext={imageContext}
          />
        </>
      )}

      {/* Section heading */}
      <h3 className={cn('mb-2 text-sm font-semibold text-foreground', !isSplit && 'mt-5')}>
        {t('reference.solution')}
      </h3>

      {/* The solution itself */}
      <RichMathEditorRenderer
        content={reference}
        lightImageBackground={false}
        imageContext={imageContext}
      />
    </div>
  )
}
