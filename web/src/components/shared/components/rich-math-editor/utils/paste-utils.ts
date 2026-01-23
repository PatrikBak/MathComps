import { isUrl } from '@/components/shared/utils/string-utils'

import { type FileUploadParams, type FileValid, handleFileUpload } from './attachment-utils'
import { createMarkdownLink, type EditContext, type EditResult } from './transforms'

/** Action to replace content with an image upload */
type PasteImageAction = {
  /** Discriminator */
  type: 'image'
  /** The result of the file upload initiation */
  result: FileValid
}

/** Action to replace selection with a markdown link */
type PasteLinkAction = {
  /** Discriminator */
  type: 'link'
  /** The result of the text edit operation creating the link */
  result: EditResult
}

/** Default action - let the browser handle the paste natively */
type PasteDefaultAction = {
  /** Discriminator */
  type: 'default'
}

/**
 * Result of processing a paste event.
 */
type PasteAction = PasteImageAction | PasteLinkAction | PasteDefaultAction

/**
 * Common parameters for paste handling.
 */
type PasteHandlerParams = {
  /** Clipboard data from the paste event */
  clipboardData: DataTransfer
  /** Current editor context (selection, full text) */
  context: EditContext
  /** Current scroll position of the textarea */
  scrollTop: number
  /** Callback to update editor content */
  onChange: FileUploadParams['onChange']
  /** Callback to push new state to history */
  pushState: FileUploadParams['pushState']
  /** Callback to get fresh textarea state during async ops */
  getTextareaState: FileUploadParams['getTextareaState']
  /** Translation function for UI strings */
  tEditor: FileUploadParams['tEditor']
  /** Translation function for API errors */
  tApiErrors: FileUploadParams['tApiErrors']
}

/**
 * Processes a paste event and returns the appropriate action.
 *
 * Handles three cases:
 *
 * 1. Image paste (screenshot) → uploads image with placeholder
 * 2. URL paste over selected text → creates markdown link
 * 3. Default → let browser handle normal paste
 *
 * @param params - Parameters for paste handling
 *
 * @returns The appropriate action for the paste event
 */
export function processPaste({
  clipboardData,
  context,
  scrollTop,
  onChange,
  pushState,
  getTextareaState,
  tEditor,
  tApiErrors,
}: PasteHandlerParams): PasteAction {
  // Get text area context data
  const { start, selectedText } = context

  // Check for the first image in clipboard (screenshot paste)
  const items = Array.from(clipboardData.items)
  const imageItem = items.find((item) => item.type.startsWith('image/'))

  // If image is found...
  if (imageItem) {
    // ...try to get the image file
    const blob = imageItem.getAsFile()

    // If file is extracted...
    if (blob) {
      // Upload with translated filename
      const url = handleFileUpload({
        file: blob,
        filename: tEditor('pastedImage'),
        currentText: context.fullText,
        selectionStart: start,
        scrollTop,
        onChange,
        pushState,
        getTextareaState,
        tEditor,
        tApiErrors,
      })

      // Return the new state
      return { type: 'image', result: url }
    }
  }

  // Check for URL paste over selected text
  const pastedText = clipboardData.getData('text/plain')

  // If URL is found over selected text...
  if (selectedText && isUrl(pastedText)) {
    // ...create a markdown link for that text
    const result = createMarkdownLink(context, pastedText)

    // Return the new state
    return { type: 'link', result }
  }

  // Default: let the browser handle normal paste
  return { type: 'default' }
}
