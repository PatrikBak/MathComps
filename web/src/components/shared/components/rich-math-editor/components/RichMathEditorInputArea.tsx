import { useTranslations } from 'next-intl'
import { useDropzone } from 'react-dropzone'

import { cn } from '@/components/shared/utils/css-utils'

import { type UseEditorTextResult } from '../hooks/use-editor-text'
import { type UseEditorUploadsResult } from '../hooks/use-editor-uploads'
import { RichMathEditorPreview } from './RichMathEditorPreview'

/**
 * Props for the {@link RichMathEditorInputArea} component.
 */
type RichMathEditorInputAreaProps = {
  /** The text the input area shows and takes edits to. */
  text: UseEditorTextResult
  /** The ways content other than typing reaches the text. */
  uploads: UseEditorUploadsResult
  /** Handler for keys pressed in the text. */
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
  /** Placeholder text shown when the textarea is empty. */
  placeholder: string
  /** Whether the rendered text stands in place of the textarea. */
  showsPreview: boolean
  /** Classes for the drop target the text stands in. */
  containerClassName: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value' | 'ref' | 'onKeyDown'
>

/**
 * The rich math editor's input area: its textarea, standing in the drop target for file uploads, and
 * the preview laid over the textarea at exactly its size. The preview sits inside the drop target so a
 * file dropped onto it still uploads, and the textarea stays mounted under it, keeping its scroll and
 * selection.
 */
export function RichMathEditorInputArea({
  text,
  uploads,
  onKeyDown,
  placeholder,
  showsPreview,
  containerClassName,
  ...textareaProps
}: RichMathEditorInputAreaProps) {
  // Editor translations
  const tEditor = useTranslations('ui.editor')

  // The drop target, taking one file at a time and leaving clicks and keys to the text
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploads.handleDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    disabled: !uploads.takesDrops,
  })

  // The drop target holding the text and its preview
  return (
    <div
      {...getRootProps({
        className: cn(
          'flex flex-col min-h-0 relative group cursor-text resize-none',
          containerClassName
        ),
      })}
    >
      {/* Dropzone hidden input */}
      <input {...getInputProps()} />

      {/* Main textarea */}
      <textarea
        ref={text.attachTextarea}
        value={text.state.text}
        onChange={text.handleChange}
        onKeyDown={onKeyDown}
        onPaste={uploads.handlePaste}
        placeholder={placeholder}
        {...textareaProps}
        // Let a HeadlessUI focus trap land here first, over its own dismiss controls
        data-autofocus={textareaProps.autoFocus || undefined}
        className={cn(
          'appearance-none w-full px-3 py-2 bg-transparent text-sm text-foreground font-mono',
          'outline-none transition-colors overflow-y-auto min-h-[120px] resize-none',
          isDragActive && 'bg-brand/10',
          textareaProps.className,
          showsPreview && 'invisible'
        )}
      />

      {/* The preview, over the text it renders */}
      {showsPreview && (
        <RichMathEditorPreview
          content={text.state.text}
          className="absolute inset-0 overflow-y-auto cursor-auto"
        />
      )}

      {/* Drag overlay indicator */}
      {isDragActive && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center pointer-events-none',
            'bg-brand/10 border-2 border-dashed border-brand rounded-lg'
          )}
        >
          <span className="text-brand-light text-sm font-medium">{tEditor('dropToUpload')}</span>
        </div>
      )}
    </div>
  )
}
