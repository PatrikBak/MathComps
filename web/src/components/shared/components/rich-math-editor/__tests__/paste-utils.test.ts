import { describe, expect, it } from 'vitest'

import { processPaste } from '../utils/paste-utils'
import { type EditContext } from '../utils/transforms'

/** What the editor holds, with a word selected for a paste to land on. */
const SELECTED = { fullText: 'a bound', start: 2, end: 7 }

/** The image a screenshot paste carries. */
const SCREENSHOT = new File([], 'screenshot.png', { type: 'image/png' })

/**
 * Builds the clipboard a paste arrives with.
 *
 * @param text - The plain text on the clipboard.
 * @param withImage - Whether the clipboard also carries an image, as a screenshot paste does.
 *
 * @returns The clipboard.
 */
function clipboardOf(text: string, withImage = false): DataTransfer {
  // The clipboard's items: the screenshot, or none
  const items = withImage ? [{ type: 'image/png', getAsFile: () => SCREENSHOT }] : []

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
function contextOf(selection: Omit<EditContext, 'selectedText'>): EditContext {
  // The context, with the selection read off the text
  return {
    ...selection,
    selectedText: selection.fullText.substring(selection.start, selection.end),
  }
}

describe('processPaste', () => {
  it('turns a URL pasted over selected text into a link around it', () => {
    // A URL pasted over the selected word
    const action = processPaste({
      clipboardData: clipboardOf('https://example.com'),
      context: contextOf(SELECTED),
      allowImageUpload: true,
    })

    // Which becomes the link's target
    expect(action).toEqual({
      type: 'link',
      result: expect.objectContaining({ newText: 'a [bound](https://example.com)' }),
    })
  })

  it('leaves a URL pasted at a bare cursor to the browser', () => {
    // A cursor with nothing selected
    const cursor = contextOf({ fullText: 'a bound', start: 7, end: 7 })

    // A URL pasted there
    const action = processPaste({
      clipboardData: clipboardOf('https://example.com'),
      context: cursor,
      allowImageUpload: true,
    })

    // Which goes in as plain text
    expect(action.type).toBe('default')
  })

  it('leaves plain text pasted over a selection to the browser', () => {
    // Plain words pasted over the selected word
    const action = processPaste({
      clipboardData: clipboardOf('another bound'),
      context: contextOf(SELECTED),
      allowImageUpload: true,
    })

    // Which replace it the way any paste does
    expect(action.type).toBe('default')
  })

  it('hands over the image of a screenshot paste, ahead of any text beside it', () => {
    // A clipboard carrying both an image and its URL, pasted over the selected word
    const action = processPaste({
      clipboardData: clipboardOf('https://example.com', true),
      context: contextOf(SELECTED),
      allowImageUpload: true,
    })

    // The image is what the paste is for
    expect(action).toEqual({ type: 'image', file: SCREENSHOT })
  })

  it('reads the text of a screenshot paste where the editor takes no images', () => {
    // A clipboard carrying both an image and its URL
    const action = processPaste({
      clipboardData: clipboardOf('https://example.com', true),
      context: contextOf(SELECTED),
      allowImageUpload: false,
    })

    // Where an editor that takes no images falls to the text
    expect(action.type).toBe('link')
  })
})
