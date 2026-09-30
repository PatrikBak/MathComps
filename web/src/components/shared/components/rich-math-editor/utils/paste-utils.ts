import { isUrl } from '@/components/shared/utils/string-utils'

import { createMarkdownLink, type EditContext, type EditResult } from './transforms'

/** Action to upload the image a paste carries */
type PasteImageAction = {
  /** Discriminator */
  type: 'image'
  /** The pasted image */
  file: File
}

/** Action to replace selection with a markdown link */
type PasteLinkAction = {
  /** Discriminator */
  type: 'link'
  /** The edit wrapping the selection in a link to the pasted URL */
  result: EditResult
}

/** The browser's own paste */
type PasteDefaultAction = {
  /** Discriminator */
  type: 'default'
}

/**
 * Result of processing a paste event.
 */
type PasteAction = PasteImageAction | PasteLinkAction | PasteDefaultAction

/**
 * The paste and the editor it lands in.
 */
type PasteHandlerParams = {
  /** What the paste carries */
  clipboardData: DataTransfer
  /** The selection the paste lands on, and the text around it */
  context: EditContext
  /** Whether an image in the clipboard may be uploaded */
  allowImageUpload: boolean
}

/**
 * Works out what a paste into the text comes to, checked in this order:
 *
 * - Image paste (screenshot) → the image to upload
 * - URL paste over selected text → creates markdown link
 * - Default → let browser handle normal paste
 *
 * @param params - The paste and the editor it lands in
 *
 * @returns The appropriate action for the paste event
 */
export function processPaste({
  clipboardData,
  context,
  allowImageUpload,
}: PasteHandlerParams): PasteAction {
  // Check for the first image in clipboard (screenshot paste)
  const items = Array.from(clipboardData.items)
  const imageItem = items.find((item) => item.type.startsWith('image/'))

  // If image is found and this editor takes image uploads...
  if (imageItem && allowImageUpload) {
    // ...try to get the image file
    const file = imageItem.getAsFile()

    // If file is extracted, it is the one to upload
    if (file) {
      return { type: 'image', file }
    }
  }

  // The pasted text
  const pastedText = clipboardData.getData('text/plain')

  // If URL is found over selected text...
  if (context.selectedText && isUrl(pastedText)) {
    // ...the edit wrapping the selected text in a link to the URL
    const result = createMarkdownLink(context, pastedText)

    // The paste becomes a link
    return { type: 'link', result }
  }

  // Default: let the browser handle normal paste
  return { type: 'default' }
}
