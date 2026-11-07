import { cn } from '@/components/shared/utils/css-utils'

import { useOwnFileLinks } from '../hooks/use-own-file-links'
import { type NumberReferenceRenderer, RichMathEditorRenderer } from './RichMathEditorRenderer'

/**
 * Props for the {@link RichMathEditorPreview} component.
 */
type RichMathEditorPreviewProps = {
  /** The markdown being written */
  content: string
  /** What a `#N` in the text is drawn as */
  renderNumberReference: NumberReferenceRenderer | undefined
  /** Placement classes for where the preview stands */
  className: string
}

/**
 * What an editor's text renders as, in the padding of the box the text is written in.
 */
export function RichMathEditorPreview({
  content,
  renderNumberReference,
  className,
}: RichMathEditorPreviewProps) {
  // The links to the files the writer uploaded into the text
  const fileLinks = useOwnFileLinks(content)

  // The rendered text
  return (
    <div className={cn('px-3 py-2 text-sm leading-relaxed text-muted-foreground', className)}>
      <RichMathEditorRenderer
        content={content}
        imageContext="userUploads"
        fileLinks={fileLinks}
        renderNumberReference={renderNumberReference}
      />
    </div>
  )
}
