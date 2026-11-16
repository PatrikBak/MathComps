'use client'

import { useTranslations } from 'next-intl'

import { LabelledSection } from '@/components/shared/components/LabelledSection'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { ScrollRegion } from '@/components/shared/components/ScrollRegion'
import type { ImageContext } from '@/components/shared/utils/media-utils'

/**
 * Props for the {@link ReferencePane} component.
 */
type ReferencePaneProps = {
  /** The problem as the conversation's author saw it. */
  statement: string
  /** The solution the conversation is judged against. */
  reference: string
  /** Whether the transcript stands beside this pane, carrying the statement in its own band. */
  isSplit: boolean
  /** Where the images the statement and the solution name are kept. */
  imageContext: ImageContext
}

/**
 * The solution a conversation is judged against, in a {@link ScrollRegion} of its own, since a long solution ends
 * where the viewport does.
 */
export function ReferencePane({ statement, reference, isSplit, imageContext }: ReferencePaneProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('conversationReview')

  return (
    <ScrollRegion label={t('tabs.reference')} className="flex-1 space-y-6 px-5 py-4">
      {/* The statement, only where the transcript's own band isn't already showing it */}
      {!isSplit && (
        <LabelledSection label={t('reference.statement')}>
          <div className="math-typography math-reference">
            <RichMathEditorRenderer content={statement} imageContext={imageContext} />
          </div>
        </LabelledSection>
      )}

      {/* The solution */}
      <LabelledSection label={t('reference.solution')}>
        <div className="math-typography math-reference">
          <RichMathEditorRenderer content={reference} imageContext={imageContext} />
        </div>
      </LabelledSection>
    </ScrollRegion>
  )
}
