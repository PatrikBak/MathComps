import type { KeyboardEventHandler } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { useEditorPreview } from '../hooks/use-editor-preview'
import { type UseEditorTextResult } from '../hooks/use-editor-text'
import { type UseEditorUploadsResult } from '../hooks/use-editor-uploads'
import { type ToolbarConfig } from './RichMathEditor'
import { RichMathEditorInputArea } from './RichMathEditorInputArea'
import { RichMathEditorToolbar } from './RichMathEditorToolbar'

/**
 * Props for the {@link RichMathEditorPane} component.
 */
type RichMathEditorPaneProps = {
  /** The text the pane shows and edits */
  text: UseEditorTextResult
  /** The ways content other than typing reaches the text */
  uploads: UseEditorUploadsResult
  /** Which toolbar entries to show */
  toolbarConfig: ToolbarConfig | undefined
  /** The id of the text field */
  id?: string
  /** Placeholder text shown while the text is empty */
  placeholder: string
  /** Whether the text takes the cursor as the pane mounts */
  autoFocus: boolean
  /** Handler for keys pressed in the text */
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  /** Whether the pane offers a preview in place of its text */
  canPreview: boolean
  /** Opens the expanded editor, or null where there is none to open */
  onExpand: (() => void) | null
  /** Classes for the box the text is written in */
  textClassName?: string
}

/**
 * Where an editor's text is written: the toolbar over the text, which its preview can stand in for.
 */
export function RichMathEditorPane({
  text,
  uploads,
  toolbarConfig,
  id,
  placeholder,
  autoFocus,
  onKeyDown,
  canPreview,
  onExpand,
  textClassName,
}: RichMathEditorPaneProps) {
  // The text's in-place preview
  const preview = useEditorPreview({
    hasContent: text.state.hasContent,
    canPreview,
    textareaRef: text.textareaRef,
  })

  // The toolbar over the text
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <RichMathEditorToolbar
        config={toolbarConfig}
        preview={canPreview ? preview : null}
        onExpand={onExpand}
        onEdit={text.applyTransform}
        onInsert={text.insertAtCursor}
        onImageClick={uploads.openImagePicker}
        onAttachmentClick={uploads.openAttachmentPicker}
      />

      {/* The text, or its preview */}
      <RichMathEditorInputArea
        text={text}
        uploads={uploads}
        onKeyDown={onKeyDown}
        id={id}
        placeholder={placeholder}
        autoFocus={autoFocus}
        showsPreview={preview.isShown}
        containerClassName={cn('flex-1 min-h-0', textClassName)}
        className="h-full"
      />
    </div>
  )
}
