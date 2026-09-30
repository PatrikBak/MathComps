import { cn } from '@/components/shared/utils/css-utils'

import { RichMathEditorRenderer } from './RichMathEditorRenderer'

/**
 * Props for the {@link RichMathEditorPreview} component.
 */
type RichMathEditorPreviewProps = {
  /** The markdown being written */
  content: string
  /** Placement classes for where the preview stands */
  className: string
}

/**
 * What an editor's text renders as, in the padding of the box the text is written in.
 */
export function RichMathEditorPreview({ content, className }: RichMathEditorPreviewProps) {
  // The rendered text
  return (
    <div className={cn('px-3 py-2 text-sm leading-relaxed text-muted-foreground', className)}>
      <RichMathEditorRenderer content={content} imageContext="userUploads" />
    </div>
  )
}
