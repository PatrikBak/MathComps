import { useCallbackRef, useFileDialog } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import type { ClipboardEventHandler } from 'react'
import { toast } from 'sonner'

import { assertNever } from '@/components/shared/utils/assert-never'
import { type FileType, validateFile } from '@/lib/file-upload-utils'

import { EDITOR_UPLOADS, editorFileTypeOf, toastUploadError } from '../utils/attachment-utils'
import { processPaste } from '../utils/paste-utils'
import { type UseEditorTextResult } from './use-editor-text'

/**
 * Options for the {@link useEditorUploads} hook.
 */
type UseEditorUploadsOptions = {
  /** The text the content is written into. */
  text: UseEditorTextResult
  /** Whether image uploads (paste and drag-drop included) are available. */
  allowImageUpload: boolean
  /** Whether attachment uploads (drag-drop included) are available. */
  allowAttachmentUpload: boolean
}

/**
 * Return type for the {@link useEditorUploads} hook.
 */
export type UseEditorUploadsResult = {
  /** Whether the editor takes a dropped file of any kind. */
  takesDrops: boolean
  /** Opens the image picker, or says the image limit is already reached. */
  openImagePicker: () => void
  /** Opens the attachment picker, or says the attachment limit is already reached. */
  openAttachmentPicker: () => void
  /**
   * Handles a paste into the text: an image uploads where the editor takes images, and a URL over a
   * selection becomes a link.
   */
  handlePaste: ClipboardEventHandler<HTMLTextAreaElement>
  /** Uploads the file dropped onto the editor, or says it is not one the editor takes. */
  handleDrop: (files: File[]) => void
}

/**
 * The ways content reaches an editor other than typing: files chosen in a picker, files dropped onto
 * it, and pastes, each landing in the text as its markdown.
 *
 * @param options - The text the content lands in, and which kinds of upload the editor takes.
 *
 * @returns Whether a drop is taken, the pickers, and the handlers for each way in.
 */
export function useEditorUploads({
  text,
  allowImageUpload,
  allowAttachmentUpload,
}: UseEditorUploadsOptions): UseEditorUploadsResult {
  // Editor and error translations
  const tEditor = useTranslations('ui.editor')
  const tApiErrors = useTranslations('apiErrors')

  // The parts of the text the uploads and pastes reach
  const { state, textareaRef, createEditContext, applyEdit, applyTransform } = text

  // Which kinds of file a drop may bring
  const takesDropOf: Record<FileType, boolean> = {
    image: allowImageUpload,
    attachment: allowAttachmentUpload,
  }

  /**
   * A function which checks the text has room for one more file of a kind, and says so where it has
   * none.
   *
   * @param fileType - The kind of file to check room for.
   *
   * @returns Whether one more can be added.
   */
  const ensureRoomFor = (fileType: FileType): boolean => {
    // Room for one more file of this kind
    if (state.canAddMore(fileType)) return true

    // The reader is told which limit is in the way
    switch (fileType) {
      // As many images as the text may hold
      case 'image':
        // The reader is told how many that is
        toast.error(tEditor('maxImagesReached', { max: state.maxImages }))

        // No room for another
        return false

      // As many attachments as the text may hold
      case 'attachment':
        // The reader is told how many that is
        toast.error(tEditor('maxAttachmentsReached', { max: state.maxAttachments }))

        // No room for another
        return false

      // Every kind of file is handled above
      default:
        return assertNever(fileType)
    }
  }

  /**
   * A function which writes a stored file into the text. An upload ends later than the render that
   * began it, so this always edits through the latest {@link UseEditorTextResult.applyEdit}.
   *
   * @param markdown - The markdown the file is written as.
   * @param position - Where the cursor stood as the upload began.
   * @param cursorFromEnd - How far before the end of the markdown the cursor is left.
   */
  const writeUploaded = useCallbackRef(
    (markdown: string, position: number, cursorFromEnd: number) => {
      // The editor may have closed while the file was on its way
      const textarea = textareaRef.current
      if (!textarea) return

      // The text as it is by now, which the reader may have gone on writing
      const current = textarea.value

      // Where the upload began, or the end of a text cut shorter since
      const insertAt = Math.min(position, current.length)

      // The markdown goes in at the insertion point, the cursor left the given distance before its end
      applyEdit({
        newText: current.substring(0, insertAt) + markdown + current.substring(insertAt),
        cursorPosition: insertAt + markdown.length - cursorFromEnd,
      })
    }
  )

  /**
   * A function which uploads a file and writes it into the text where the cursor stands.
   *
   * @param file - The file to upload.
   * @param givenName - The name the file reads by in the text, for a file whose own says nothing.
   */
  const upload = async (file: File, givenName?: string) => {
    // The textarea on screen, where there is one
    const textarea = textareaRef.current
    if (!textarea) return

    // Which kind of upload the file is
    const fileType = editorFileTypeOf(file)

    // A file of no kind the editor takes
    if (fileType === null) {
      // The reader is told the editor takes no such file
      toast.error(tApiErrors('INVALID_FILE_TYPE'))

      // And nothing is sent
      return
    }

    // No room for one more file of this kind
    if (!ensureRoomFor(fileType)) return

    // A file too big for its kind is refused before the reader is told it is on its way
    try {
      validateFile(file, fileType)
    } catch (error) {
      // Show the validation error's localized copy
      toastUploadError(error, tApiErrors)

      // And nothing is sent
      return
    }

    // How a file of this kind is stored and written
    const editorUpload = EDITOR_UPLOADS[fileType]

    // The name the file reads by in the text
    const name = givenName ?? editorUpload.nameOf(file)

    // The cursor in the text while the file is on its way, first, since entering a draft for the first
    // time moves its cursor to the draft's end
    textarea.focus()

    // Where the cursor stands as the upload begins, which is where the file is written
    const position = textarea.selectionStart

    // The reader is told the file is on its way
    const loadingToastId = toast.loading(tEditor('uploading', { filename: name }))

    // The upload itself, the notice taken down however it ends
    try {
      // The file goes to the store
      const key = await editorUpload.store(file)

      // The file's markdown goes into the text
      writeUploaded(editorUpload.toMarkdown(name, key), position, editorUpload.cursorFromEnd)
    } catch (error) {
      // Show the upload error's localized copy
      toastUploadError(error, tApiErrors)
    } finally {
      // The content appearing, or the error, is the feedback from here on
      toast.dismiss(loadingToastId)
    }
  }

  /**
   * A function which uploads the file a picker handed over. The picker keeps hold of the callback it
   * opened with, so this is one that always runs the latest upload.
   *
   * @param files - The files the picker was closed with.
   */
  const uploadPicked = useCallbackRef((files: FileList | null) => {
    // The one file a picker takes
    const file = files?.[0]
    if (!file) return

    // The file goes on its way into the text
    void upload(file)
  })

  // The image picker
  const imagePicker = useFileDialog({ multiple: false, accept: 'image/*', onChange: uploadPicked })

  // The attachment picker
  const attachmentPicker = useFileDialog({ multiple: false, onChange: uploadPicked })

  /**
   * A function which opens the image picker, where the text has room for another image.
   */
  const openImagePicker = () => {
    // Nothing to pick for a text already full of images
    if (!ensureRoomFor('image')) return

    // The picker opens on the reader's files
    imagePicker.open()
  }

  /**
   * A function which opens the attachment picker, where the text has room for another attachment.
   */
  const openAttachmentPicker = () => {
    // Nothing to pick for a text already full of attachments
    if (!ensureRoomFor('attachment')) return

    // The picker opens on the reader's files
    attachmentPicker.open()
  }

  /**
   * A function which uploads a file dropped onto the editor.
   *
   * @param files - The files the drop target took: the one dropped, or none for a drop of several.
   */
  const handleDrop = (files: File[]) => {
    // The one file a drop takes, none for a drop of several
    const file = files[0]
    if (!file) return

    // Which kind of upload the file is
    const fileType = editorFileTypeOf(file)

    // A kind of file this editor does not take from a drop, or none at all
    if (fileType === null || !takesDropOf[fileType]) {
      // The reader is told so
      toast.error(tEditor('unsupportedFileType'))

      // And nothing is sent
      return
    }

    // The file goes on its way into the text
    void upload(file)
  }

  /**
   * A function which handles a paste into the text.
   *
   * @param event - The paste.
   */
  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    // The selection the paste lands on
    const context = createEditContext()
    if (!context) return

    // What the paste comes to
    const action = processPaste({ clipboardData: event.clipboardData, context, allowImageUpload })

    // Each kind of paste goes its own way into the text
    switch (action.type) {
      // A URL pasted over selected text
      case 'link':
        // The browser's own paste is held back
        event.preventDefault()

        // The selection becomes a link to the URL
        applyTransform(() => action.result)

        // Nothing more to paste
        return

      // A pasted image
      case 'image':
        // The image uploads under a name of its own, a screenshot's file name saying nothing
        void upload(action.file, tEditor('pastedImage'))

        // The upload writes the image in once it is stored
        return

      // Anything else is the browser's to paste
      case 'default':
        return

      // Every kind of paste is handled above
      default:
        assertNever(action)
    }
  }

  // Whether a drop of any kind is taken
  const takesDrops = Object.values(takesDropOf).some(Boolean)

  // Whether a drop is taken, the pickers, and the handlers for each way in
  return { takesDrops, openImagePicker, openAttachmentPicker, handlePaste, handleDrop }
}
