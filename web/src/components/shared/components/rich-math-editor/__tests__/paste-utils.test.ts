import { describe, expect, it } from 'vitest'

import { type FileUploadParams } from '../utils/attachment-utils'
import { processPaste } from '../utils/paste-utils'
import { type EditContext } from '../utils/transforms'

/** What the editor holds, with a word selected for a paste to land on. */
const SELECTED = { fullText: 'a bound', start: 2, end: 7 }

/**
 * Builds the clipboard a paste arrives with.
 *
 * @param text - The plain text on it.
 * @param withImage - Whether it also carries an image, as a screenshot paste does.
 *
 * @returns The clipboard.
 */
function clipboardOf(text: string, withImage = false): DataTransfer {
  // The image the clipboard reports, which nothing here reads a file off
  const items = withImage ? [{ type: 'image/png', getAsFile: () => null }] : []

  // The clipboard as a paste reads it
  return {
    items,
    getData: () => text,
  } as unknown as DataTransfer
}

/**
 * Builds the editor context a paste is applied to.
 *
 * @param selection - Where the selection sits in the text.
 *
 * @returns The context.
 */
function contextOf(selection: { fullText: string; start: number; end: number }): EditContext {
  // The context, with the selection read off the text
  return {
    ...selection,
    selectedText: selection.fullText.substring(selection.start, selection.end),
  }
}

/**
 * Runs a paste, with the callbacks its upload path would need standing by unused.
 *
 * @param clipboardData - The clipboard the paste arrives with.
 * @param context - The editor context it lands in.
 * @param allowImageUpload - Whether this editor takes images at all.
 *
 * @returns The action the paste asks for.
 */
function paste(clipboardData: DataTransfer, context: EditContext, allowImageUpload: boolean) {
  // The action, with the upload callbacks standing by
  return processPaste({
    clipboardData,
    context,
    scrollTop: 0,
    allowImageUpload,
    onChange: () => {},
    pushState: () => {},
    getTextareaState: () => null,
    tEditor: (() => '') as unknown as FileUploadParams['tEditor'],
    tApiErrors: (() => '') as unknown as FileUploadParams['tApiErrors'],
  })
}

describe('processPaste', () => {
  it('turns a URL dropped on selected text into a link around it', () => {
    // A URL pasted over the selected word
    const action = paste(clipboardOf('https://example.com'), contextOf(SELECTED), true)

    // Which becomes the link's target
    expect(action).toEqual({
      type: 'link',
      result: expect.objectContaining({ newText: 'a [bound](https://example.com)' }),
    })
  })

  it('leaves a URL pasted at a bare cursor to the browser', () => {
    // A cursor with nothing selected
    const cursor = contextOf({ fullText: 'a bound', start: 7, end: 7 })

    // Where the URL goes in as plain text
    expect(paste(clipboardOf('https://example.com'), cursor, true).type).toBe('default')
  })

  it('leaves plain text dropped on a selection to the browser', () => {
    expect(paste(clipboardOf('another bound'), contextOf(SELECTED), true).type).toBe('default')
  })

  it('reads the text of a screenshot paste where the editor takes no images', () => {
    // A clipboard carrying both an image and its URL
    const clipboard = clipboardOf('https://example.com', true)

    // Where an editor that takes no images falls to the text
    expect(paste(clipboard, contextOf(SELECTED), false).type).toBe('link')
  })
})
