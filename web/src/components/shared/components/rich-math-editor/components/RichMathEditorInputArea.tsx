import { useTranslations } from 'next-intl'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { isAllowedMimeType } from '@/lib/file-upload-utils'

import { ensureVisibleCaret } from '../../../utils/dom-utils'
import { type EditorViewModel } from '../hooks/use-editor-model'
import {
  handleFileUpload,
  MAX_EDITOR_ATTACHMENTS,
  MAX_EDITOR_IMAGES,
} from '../utils/attachment-utils'
import { processPaste } from '../utils/paste-utils'
import { type EditContext } from '../utils/transforms'
import type { RichMathEditorVariant } from './RichMathEditor'

/**
 * Handle exposed by the {@link RichMathEditorInputArea} component.
 */
export type RichMathEditorInputAreaRef = {
  /** Opens the image file picker dialog. */
  openImagePicker: () => void
  /** Opens the attachment file picker dialog. */
  openAttachmentPicker: () => void
}

/**
 * Props for the {@link RichMathEditorInputArea} component.
 */
type RichMathEditorInputAreaProps = {
  /** Visual variant of the editor */
  variant: RichMathEditorVariant
  /** When true, omits border styling (for use in containers that handle their own borders) */
  borderless?: boolean
  /** The shared view-model from the parent editor. */
  viewModel: EditorViewModel
  /** Handler for textarea onChange events. */
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  /** Handler for textarea onKeyDown events. */
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
  /** Placeholder text shown when the textarea is empty. */
  placeholder?: string
  /** Whether image uploads (paste and drag-drop included) are available. */
  allowImageUpload: boolean
  /** Whether attachment uploads (drag-drop included) are available. */
  allowAttachmentUpload: boolean
  /** Usage specific class name for the wrapper div */
  containerClassName?: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value' | 'ref' | 'onKeyDown'
>

/**
 * The input area of the {@link RichMathEditor}, containing the textarea
 * and hidden file inputs.
 *
 * Handles:
 * - Drag-and-drop file uploads
 * - Paste handling for images and markdown links
 * - Hidden file inputs for manual upload dialogs
 */
export const RichMathEditorInputArea = forwardRef<
  RichMathEditorInputAreaRef,
  RichMathEditorInputAreaProps
>(
  (
    {
      variant,
      viewModel,
      onChange,
      onKeyDown,
      placeholder,
      allowImageUpload,
      allowAttachmentUpload,
      borderless,
      containerClassName,
      ...textareaProps
    },
    ref
  ) => {
    // Get translations
    const tEditor = useTranslations('ui.editor')
    const tApiErrors = useTranslations('apiErrors')

    // Get needed state from the view-model
    const { textareaRef, attachTextarea, state, applyTransform } = viewModel

    // The ref for the hidden input elements for image and attachment uploads
    const imageFileInputRef = useRef<HTMLInputElement>(null)
    const attachmentFileInputRef = useRef<HTMLInputElement>(null)

    /**
     * Gets the current state of the textarea for async operations.
     *
     * This is needed during file uploads because the upload is async and
     * the textarea content may have changed by the time the upload completes.
     *
     * @returns The current textarea state, or null if textarea is not available.
     */
    const getTextareaState = useCallback(() => {
      // Ensure we have a valid textarea
      const textarea = textareaRef.current
      if (!textarea) return null

      // Return the current state of the textarea
      return {
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        scrollTop: textarea.scrollTop,
      }
    }, [textareaRef])

    /**
     * Callback for file uploads to update the editor content.
     *
     * This is passed to the file upload handler and called when the upload
     * completes to insert the markdown for the uploaded file.
     *
     * @param newValue - The new text content with the uploaded file markdown.
     */
    const handleValueChange = useCallback(
      (newValue: string) => {
        // Ensure we have a valid textarea
        const textarea = textareaRef.current
        if (!textarea) return

        // Temporarily set the textarea value and dispatch an input event
        // This ensures React's controlled component pattern is respected
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set

        // If we have a valid setter
        if (nativeInputValueSetter) {
          // Call it to set the value
          nativeInputValueSetter.call(textarea, newValue)

          // Dispatch an input event
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
        }
      },
      [textareaRef]
    )

    /**
     * Pushes a new state to the history after a file upload.
     *
     * @param newText - The new text content.
     * @param cursorPosition - Where to place the cursor.
     * @param scrollTop - The scroll position to restore.
     */
    const pushStateAfterUpload = useCallback(
      (newText: string, cursorPosition: number, scrollTop: number) => {
        // Update via the normal change flow
        handleValueChange(newText)

        // Restore cursor position after the change propagates
        setTimeout(() => {
          const textarea = textareaRef.current
          if (!textarea) return
          textarea.setSelectionRange(cursorPosition, cursorPosition)
          textarea.scrollTop = scrollTop
        }, 0)
      },
      [handleValueChange, textareaRef]
    )

    /**
     * Checks if more items of a given type can be uploaded.
     *
     * Shows an error toast if the limit has been reached.
     *
     * @param contentType - The type of content to check ('image' or 'attachment').
     *
     * @returns `true` if more can be added, `false` if limit reached.
     */
    const checkAndShowUploadLimitError = useCallback(
      (contentType: 'image' | 'attachment'): boolean => {
        // Check against the current state
        const canAddMore = state.canAddMore(contentType)

        // Show toast if limit reached
        if (!canAddMore) {
          switch (contentType) {
            case 'image':
              toast.error(tEditor('maxImagesReached', { max: MAX_EDITOR_IMAGES }))
              break
            case 'attachment':
              toast.error(tEditor('maxAttachmentsReached', { max: MAX_EDITOR_ATTACHMENTS }))
              break
          }
        }

        // Return pre-toast state
        return canAddMore
      },
      [state, tEditor]
    )

    /**
     * Opens a file picker dialog for the given content type.
     * Shows an error toast if the limit for that type has been reached.
     */
    const openPicker = useCallback(
      (contentType: 'image' | 'attachment') => {
        // Validate
        if (!checkAndShowUploadLimitError(contentType)) return

        // Get the right picker
        const picker = (contentType === 'image' ? imageFileInputRef : attachmentFileInputRef)
          ?.current

        // Open the picker
        picker?.click()
      },
      [checkAndShowUploadLimitError]
    )

    // Expose the file picker functions to parent components
    useImperativeHandle(ref, () => ({
      openImagePicker: () => openPicker('image'),
      openAttachmentPicker: () => openPicker('attachment'),
    }))

    /**
     * Uploads a file to the editor, handling all the common logic.
     *
     * @param file - The file to upload.
     * @param stripExtension - If true, remove extension from filename (for image alt text).
     * @returns true if upload was initiated successfully.
     */
    const uploadFileToEditor = useCallback(
      (file: File, stripExtension: boolean): boolean => {
        // Ensure we have a valid textarea
        const textarea = textareaRef.current
        if (!textarea) return false

        // Get the filename, removing extension if needed
        const filename = stripExtension ? file.name.replace(/\.[^/.]+$/, '') : undefined

        // Upload the file
        const uploadResult = handleFileUpload({
          file,
          filename,
          currentText: state.text,
          selectionStart: textarea.selectionStart,
          scrollTop: textarea.scrollTop,
          onChange: handleValueChange,
          pushState: pushStateAfterUpload,
          getTextareaState,
          tEditor,
          tApiErrors,
        })

        // Ensure the caret is visible if the upload was successful
        if (uploadResult.success) {
          ensureVisibleCaret(textarea)
        }

        // Return success
        return uploadResult.success
      },
      [
        state.text,
        handleValueChange,
        pushStateAfterUpload,
        getTextareaState,
        textareaRef,
        tEditor,
        tApiErrors,
      ]
    )

    /**
     * Creates a file select handler for a hidden file input.
     *
     * @param inputRef - Ref to the hidden file input (to clear after selection).
     * @param stripExtension - If true, remove extension from filename (for image alt text).
     */
    const createFileSelectHandler = useCallback(
      (inputRef: React.RefObject<HTMLInputElement | null>, stripExtension: boolean) =>
        (event: React.ChangeEvent<HTMLInputElement>) => {
          // Get the selected file
          const file = event.target.files?.[0]
          if (!file) return

          // Upload the file
          uploadFileToEditor(file, stripExtension)

          // Clear the input so the same file can be selected again
          if (inputRef.current) {
            inputRef.current.value = ''
          }
        },
      [uploadFileToEditor]
    )

    /** The handler for image file selection, which removes the extension from the filename */
    const handleImageFileSelect = createFileSelectHandler(imageFileInputRef, true)

    /** The handler for attachment file selection, which does not remove the extension from the filename */
    const handleAttachmentFileSelect = createFileSelectHandler(attachmentFileInputRef, false)

    /**
     * Handles a file dropped onto the editor.
     *
     * Supports both images and attachments. Shows an error for unsupported types.
     *
     * @param acceptedFiles - Array of files from react-dropzone (only first is used).
     */
    const handleFileDrop = useCallback(
      (acceptedFiles: File[]) => {
        // Get the first file (multiple: false ensures only one)
        const file = acceptedFiles[0]
        if (!file) return

        // Determine file type, counting only the upload kinds this editor has enabled
        const isImage = allowImageUpload && isAllowedMimeType(file.type, 'image')
        const isAttachment = allowAttachmentUpload && isAllowedMimeType(file.type, 'attachment')

        // Reject unsupported file types
        if (!isImage && !isAttachment) {
          toast.error(tEditor('unsupportedFileType'))
          return
        }

        // Check upload limit
        if (!checkAndShowUploadLimitError(isImage ? 'image' : 'attachment')) return

        // Upload the file (strip extension for images)
        uploadFileToEditor(file, isImage)
      },
      [
        uploadFileToEditor,
        checkAndShowUploadLimitError,
        tEditor,
        allowImageUpload,
        allowAttachmentUpload,
      ]
    )

    // Configure react-dropzone
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      // Pass our custom handler
      onDrop: handleFileDrop,
      // Don't open file dialog on click (we have separate buttons)
      noClick: true,
      // Don't open file dialog on keyboard events
      noKeyboard: true,
      // Only accept one file at a time
      multiple: false,
      // Disabled when no upload kind is enabled
      disabled: !allowImageUpload && !allowAttachmentUpload,
    })

    /**
     * Handles paste events in the textarea.
     *
     * Supports:
     * - Pasting images from clipboard (uploads them)
     * - Pasting URLs over selected text (creates markdown links)
     *
     * @param event - The React clipboard event.
     */
    const handlePaste = useCallback(
      (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // Ensure we have a textarea
        const textarea = textareaRef.current
        if (!textarea) return

        // Create the edit context from current selection
        const editContext: EditContext = {
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
          selectedText: state.text.substring(textarea.selectionStart, textarea.selectionEnd),
          fullText: state.text,
        }

        // Process the paste event
        const pasteAction = processPaste({
          clipboardData: event.clipboardData,
          context: editContext,
          scrollTop: textarea.scrollTop,
          allowImageUpload,
          onChange: handleValueChange,
          pushState: pushStateAfterUpload,
          getTextareaState,
          tEditor,
          tApiErrors,
        })

        // Handle different paste actions
        switch (pasteAction.type) {
          case 'link':
            // URL pasted over selected text - create markdown link
            event.preventDefault()
            applyTransform(() => pasteAction.result)
            break

          // Upload + placeholder insertion already ran in processPaste; just
          // proceed to the caret handling below
          case 'image':
            break

          case 'default':
            // Let the browser handle the paste normally
            return

          default:
            assertNever(pasteAction)
        }

        // Ensure visible caret after paste
        ensureVisibleCaret(textarea)
      },
      [
        textareaRef,
        state.text,
        allowImageUpload,
        handleValueChange,
        pushStateAfterUpload,
        getTextareaState,
        applyTransform,
        tApiErrors,
        tEditor,
      ]
    )

    /**
     * Callback for when the textarea receives focus.
     *
     * This ensures the cursor is placed at the end of the input.
     */
    const onFocus = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
      event.target.setSelectionRange(event.target.value.length, event.target.value.length)
    }, [])

    // Variant-based style of the textarea
    const variantStyle = {
      card: cn('bg-surface-inset/50', !borderless && 'border-x border-foreground/10'),
      inline: 'bg-inset border border-b-0 border-foreground/10 rounded-t-lg',
    }[variant]

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

        {/* Hidden file input for images */}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileSelect}
          className="hidden"
        />

        {/* Hidden file input for attachments */}
        <input
          ref={attachmentFileInputRef}
          type="file"
          onChange={handleAttachmentFileSelect}
          className="hidden"
        />

        {/* Main textarea */}
        <textarea
          ref={attachTextarea}
          value={state.text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onPaste={handlePaste}
          placeholder={placeholder}
          {...textareaProps}
          // Let a HeadlessUI focus trap land here first, over its own dismiss controls
          data-autofocus={textareaProps.autoFocus || undefined}
          className={cn(
            'appearance-none w-full px-4 py-3 text-sm text-foreground font-mono outline-none transition-colors overflow-y-auto min-h-[120px] resize-none',
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/60',
            variantStyle,
            isDragActive && 'bg-brand/10 border-brand/50',
            textareaProps.className
          )}
        />

        {/* Drag overlay indicator */}
        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand/10 border-2 border-dashed border-brand rounded-lg pointer-events-none">
            <span className="text-brand-light text-sm font-medium">{tEditor('dropToUpload')}</span>
          </div>
        )}
      </div>
    )
  }
)
