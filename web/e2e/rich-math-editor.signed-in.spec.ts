import type { FileChooser, Locator, Page, Request } from '@playwright/test'

import type { UserProfile } from '@/components/features/profile/model/profile-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import messages from '../messages/en.json'
import {
  answerJson,
  BACKEND_ORIGIN,
  fileLinkTo,
  PROBLEMS_PATH,
  refuse,
} from './support/backend-routes'
import {
  apiErrorsCopy,
  areaPath,
  editorCopy,
  modalCopy,
  openExistingDefense,
} from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend } from './support/hosted-backend'
import {
  blankPng,
  type CarriedFile,
  cursorIn,
  dropFile,
  isKeptInStorage,
  naturalWidthOf,
  pasteFile,
  pickFile,
} from './support/interaction'
import { searchAnswerWith, stubSearchAnswer } from './support/problem-actions'
import { expect, test } from './support/test'
import { countRemovals } from './support/watchers'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A pause longer than the text's history takes to call the next edit a step of its own. */
const HISTORY_STEP_MS = 600

/**
 * Opens a chat's composer.
 *
 * @param page - The page the composer is opened on.
 *
 * @returns The composer, live and ready to be written in.
 */
async function openComposer(page: Page): Promise<Locator> {
  // A student inside a competition
  await installHostedBackend(page, 'running')

  // Open the competition's area
  await page.goto(areaPath(COMPETITION_SLUG))

  // And the conversation already seeded on the first problem
  await openExistingDefense(page)

  // The composer, which comes first even while an expanded view stands a second textarea over it
  const composer = page.locator('textarea').first()

  // Live once the resumed conversation has loaded
  await expect(composer).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // What the reader writes in
  return composer
}

/**
 * Expands an open composer to its modal.
 *
 * @param page - The page the composer is on.
 *
 * @returns The expanded view, open with the cursor in its text.
 */
async function expandComposer(page: Page): Promise<Locator> {
  // Expanded, which stands a second editor over the inline one
  await page.getByTitle(editorCopy.expandEditor).click()

  // The expanded view, named because the chat it is written in is a dialog of its own
  const expanded = page.getByRole('dialog', { name: editorCopy.expandedEditor })

  // The expanded view open, with the cursor in its text
  await expect(expanded.locator('textarea')).toBeFocused()

  // The view the reader now writes in
  return expanded
}

/**
 * Opens a chat's composer, expands it to its modal, and closes that again.
 *
 * @param page - The page the composer is opened on.
 * @param dismiss - Which way out of the expanded view is taken.
 *
 * @returns The inline composer, which is what the reader is left writing in.
 */
async function expandAndCollapse(page: Page, dismiss: 'button' | 'escape') {
  // The composer, open
  const composer = await openComposer(page)

  // The composer's expanded view, open
  const expanded = await expandComposer(page)

  // And closed again, the way this run is taking
  switch (dismiss) {
    // By the key that dismisses the expanded view
    case 'escape':
      await page.keyboard.press('Escape')
      break

    // By the expanded view's own close button
    case 'button':
      await expanded.getByRole('button', { name: modalCopy.close }).click()
      break

    // Every way out is taken above
    default:
      assertNever(dismiss)
  }

  // Gone from the page
  await expect(expanded).toHaveCount(0)

  // What the reader is left writing in
  return composer
}

test.describe('the editor expanded to its modal', () => {
  test('hands the cursor back on the way out', async ({ page }) => {
    // A composer taken to the expanded view and back
    const composer = await expandAndCollapse(page, 'button')

    // The cursor, back where the reader writes
    await expect(composer).toBeFocused()

    // Typed without reaching for the mouse
    await page.keyboard.type('A bound that holds')

    // And the typing lands in the composer
    await expect(composer).toHaveValue('A bound that holds')
  })

  test('leaves the toolbar underneath it still editing', async ({ page }) => {
    // A composer taken to the expanded view and back, by the key that dismisses the view
    const composer = await expandAndCollapse(page, 'escape')

    // A draft to work on
    await composer.fill('A bound')

    // Bold, which is the cheapest thing the toolbar can be asked for
    await page.getByTitle(/^Bold/).click()

    // And bold's marks land in the draft
    await expect(composer).toHaveValue(/\*\*/)
  })

  test('goes on writing from the end of the draft it opens with', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft begun inline
    await composer.fill('A bound')

    // Taken to the expanded view
    const expanded = await expandComposer(page)

    // And written on without reaching for the mouse
    await page.keyboard.type(' holds')

    // The writing picks up where the draft left off
    await expect(expanded.locator('textarea')).toHaveValue('A bound holds')
  })

  test('edits the one text both views show', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft begun inline
    await composer.fill('ab')

    // Taken to the expanded view
    const expanded = await expandComposer(page)

    // The expanded view's own text
    const expandedText = expanded.locator('textarea')

    // With the cursor put between the two letters
    await expandedText.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(1, 1))

    // Inline math from the expanded view's toolbar
    await expanded.getByTitle(/^Inline math/).click()

    // The formula inline math writes, typed over
    await page.keyboard.type('n')

    // The math lands at the cursor of the text on top, the one underneath having a cursor of its own
    await expect(expandedText).toHaveValue('a$n$b')

    // Back to the inline composer
    await page.keyboard.press('Escape')

    // The expanded view gone from the page
    await expect(expanded).toHaveCount(0)

    // The inline composer holds the same text
    await expect(composer).toHaveValue('a$n$b')
  })

  test('sends from the keyboard the way its own button does', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // Taken to the expanded view
    const expanded = await expandComposer(page)

    // A draft written in the expanded view
    await expanded.locator('textarea').fill('A bound that holds')

    // Sent without reaching for the mouse
    await page.keyboard.press('ControlOrMeta+Enter')

    // The expanded view goes with the draft
    await expect(expanded).toHaveCount(0)

    // The inline composer, emptied by the send
    await expect(composer).toHaveValue('')
  })

  test('keeps the images it previews while the text after them changes', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft holding two images, with a line of text after them
    await composer.fill('![one](/og-image.en.png)\n\n![two](/og-image.sk.png)\n\nA bound')

    // Taken to the expanded view, the cursor at the end of the draft
    const expanded = await expandComposer(page)

    // Both images drawn in its preview
    await expect(expanded.locator('img')).toHaveCount(2)

    // Every image leaving the page from here on, counted as it goes
    const imagesRemoved = await countRemovals(page, 'img')

    // A new line started at the end of the text
    await page.keyboard.press('Enter')

    // And a word written on it
    await page.keyboard.type('holds')

    // The preview showing the new word
    await expect(expanded.locator('p').filter({ hasText: 'holds' })).toHaveCount(1)

    // Drawn around the same two images, neither of them taken out and put back
    expect(await imagesRemoved()).toBe(0)
  })
})

test.describe('the preview in place of the text', () => {
  test('typesets the draft and hands the cursor back where it was', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft with math in it
    await composer.fill('Since $x^2 \\ge 0$, the bound holds.')

    // The cursor put right after the draft's first word
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(5, 5))

    // The toggle swapping the draft for what it renders as
    const preview = page.getByRole('button', { name: editorCopy.preview, exact: true })

    // Turned on
    await preview.click()

    // The math typeset where the draft stood, found by the TeX that KaTeX keeps beside what it draws
    await expect(page.locator('annotation', { hasText: 'x^2 \\ge 0' })).toHaveCount(1)

    // With the draft itself out of sight
    await expect(composer).toBeHidden()

    // And the cursor on the toggle, still inside the editor
    await expect(preview).toBeFocused()

    // Off again
    await preview.click()

    // The cursor back where the reader writes
    await expect(composer).toBeFocused()

    // A comma typed at the cursor
    await page.keyboard.type(',')

    // The comma lands where the cursor was left, which takes the text having stayed where it was under
    // the preview
    await expect(composer).toHaveValue('Since, $x^2 \\ge 0$, the bound holds.')
  })

  test('steps back to the text once a send empties the draft', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft to send
    await composer.fill('A bound that holds')

    // The draft read back in its preview
    await page.getByRole('button', { name: editorCopy.preview, exact: true }).click()

    // Sent from the footer, which the preview leaves within reach
    await page.getByRole('button', { name: editorCopy.submit }).click()

    // The composer on screen again
    await expect(composer).toBeVisible()

    // The composer emptied by the send
    await expect(composer).toHaveValue('')
  })
})

/**
 * Asserts a control of the toolbar stands wholly on the tools' row, none of it cut off at the row's end.
 *
 * @param page - The page the toolbar is on.
 * @param control - The control to check.
 */
async function expectWhollyOnRow(page: Page, control: Locator) {
  // The row, which is what the first tool stands on
  const row = await page.getByTitle(/^Bold/).locator('xpath=..').boundingBox()

  // The control's own box
  const box = await control.boundingBox()

  // Both laid out
  if (!row || !box) throw new Error('The toolbar row or the control is not laid out')

  // The control ends where the row does, or before it
  expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width)
}

test.describe('the toolbar over the text', () => {
  test('leaves the cursor where a tool puts it', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A two-letter draft
    await composer.fill('ab')

    // The cursor put between the draft's two letters
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(1, 1))

    // Inline math, which writes a formula to type over and selects it
    await page.getByTitle(/^Inline math/).click()

    // Typed without reaching for the mouse
    await page.keyboard.type('nk')

    // The first letter lands in place of the formula, which only a selection left on it allows, and the
    // second right after it, which takes the cursor staying put between keystrokes
    await expect(composer).toHaveValue('a$nk$b')
  })

  test('takes a symbol from its picker and hands the cursor back', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft to add to
    await composer.fill('x')

    // The panel the symbols tool opens
    await page.getByTitle(editorCopy.latexPicker.title).click()

    // A symbol picked from the panel
    await page.getByRole('button', { name: 'α', exact: true }).click()

    // Written on without reaching for the mouse
    await page.keyboard.type('+')

    // The symbol lands as math and the writing goes on after it, the panel having let go of the cursor
    await expect(composer).toHaveValue('x$\\alpha$+')
  })

  test.describe('on a phone', () => {
    // Where the composer has no room for its tools beside the words of its view controls
    test.use({ viewport: { width: 390, height: 844 } })

    test('gives up the words of its view controls before any tool', async ({ page }) => {
      // The composer, open
      await openComposer(page)

      // The preview toggle
      const preview = page.getByRole('button', { name: editorCopy.preview, exact: true })

      // The toggle down to its mark
      await expect(preview).toHaveText('')

      // The last tool this editor shows
      const lastTool = page.getByTitle(editorCopy.quote)

      // The last tool kept on the row, all of it
      await expect(lastTool).toBeVisible()
      await expectWhollyOnRow(page, lastTool)

      // Nothing listed behind a control
      await expect(page.getByTitle(editorCopy.moreOptions)).toHaveCount(0)

      // The same composer on a wide screen
      await page.setViewportSize({ width: 1280, height: 844 })

      // The toggle reads its word again
      await expect(preview).toHaveText(editorCopy.preview)
    })
  })

  test.describe('on an editor too narrow for its tools', () => {
    // The narrowest phone, where the composer has room for a few of its tools even with its view
    // controls down to their marks
    test.use({ viewport: { width: 320, height: 844 } })

    test('keeps them on one row, the rest listed behind one control', async ({ page }) => {
      // The composer, open
      const composer = await openComposer(page)

      // The control standing in for the tools the row has no room for
      const more = page.getByTitle(editorCopy.moreOptions)

      // The overflow control on the row, all of it
      await expect(more).toBeVisible()
      await expectWhollyOnRow(page, more)

      // A function which reads how far down a control stands
      const topOf = async (control: Locator) => (await control.boundingBox())?.y

      // How far down the overflow control stands
      const moreTop = await topOf(more)

      // On the same line as the first tool and as the preview toggle at the far end
      expect(await topOf(page.getByTitle(/^Bold/))).toBe(moreTop)
      expect(await topOf(page.getByRole('button', { name: editorCopy.preview, exact: true }))).toBe(
        moreTop
      )

      // A draft for a tool to act on
      await composer.fill('A bound')

      // The list of the tools that did not fit, open
      await more.click()

      // A quote picked from the list
      await page.getByRole('button', { name: editorCopy.quote }).click()

      // The quote lands on the draft
      await expect(composer).toHaveValue('> A bound')

      // With the cursor back where the reader writes
      await expect(composer).toBeFocused()
    })
  })
})

test.describe('the history of the text', () => {
  test('steps back over a tool and forward again', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A two-letter draft
    await composer.fill('ab')

    // The draft selected whole
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 2))

    // Left alone long enough for the next edit to be a step of its own
    await page.waitForTimeout(HISTORY_STEP_MS)

    // Bold around the selected draft
    await page.getByTitle(/^Bold/).click()

    // Bold's marks land around the draft
    await expect(composer).toHaveValue('**ab**')

    // One step back
    await page.keyboard.press('ControlOrMeta+z')

    // Bold's marks gone, the draft left
    await expect(composer).toHaveValue('ab')

    // One step forward
    await page.keyboard.press('ControlOrMeta+Shift+z')

    // Bold's marks back around the draft
    await expect(composer).toHaveValue('**ab**')
  })

  test('starts afresh once a send empties the draft', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // The first step of a draft
    await composer.fill('A bound')

    // Left alone long enough for the next edit to be a step of its own
    await page.waitForTimeout(HISTORY_STEP_MS)

    // The draft's second step
    await composer.fill('A bound that holds')

    // Sent without reaching for the mouse
    await page.keyboard.press('ControlOrMeta+Enter')

    // The send empties the composer
    await expect(composer).toHaveValue('')

    // One step back
    await page.keyboard.press('ControlOrMeta+z')

    // Nothing of the sent draft to return to
    await expect(composer).toHaveValue('')
  })

  test('comes back to a kept draft with the cursor at its end', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // A draft written in the composer
    await composer.fill('A bound')

    // Kept for the reader's return, once the page's storage holds the draft
    await expect
      .poll(() => isKeptInStorage(page, 'A bound'), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(true)

    // The page opened afresh
    await page.reload()

    // The conversation opened again
    await openExistingDefense(page)

    // The kept draft back in the composer
    await expect(composer).toHaveValue('A bound', { timeout: SETTLE_TIMEOUT_MS })

    // The cursor put in the composer
    await composer.focus()

    // Written on at the cursor in one stroke, so the history keeps it as one step however slowly the browser runs
    await page.keyboard.insertText(' holds')

    // The writing picks up where the kept draft left off
    await expect(composer).toHaveValue('A bound holds')

    // One step back, to the kept draft
    await page.keyboard.press('ControlOrMeta+z')

    // A mark typed at the cursor
    await page.keyboard.type('!')

    // The mark lands at the kept draft's end, where the cursor was found
    await expect(composer).toHaveValue('A bound!')
  })
})

test.describe('the view over a long draft', () => {
  // A draft far taller than the composer, every line short enough to stand on one row
  const LONG_DRAFT = Array.from({ length: 40 }, (_unused, index) => `Line ${index + 1}`).join('\n')

  test('scrolls just far enough to show a cursor a tool leaves out of view', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // The long draft, written in the composer
    await composer.fill(LONG_DRAFT)

    // The cursor and the view set by hand
    await composer.evaluate((element: HTMLTextAreaElement) => {
      // The cursor at the draft's end
      element.setSelectionRange(element.value.length, element.value.length)

      // The view at the draft's top
      element.scrollTop = 0
    })

    // A tool used at the cursor
    await page.getByTitle(/^Bold/).click()

    // How far down the view goes at most
    const bottom = await composer.evaluate(
      (element: HTMLTextAreaElement) => element.scrollHeight - element.clientHeight
    )

    // The view comes down to the last line, which is as far as it goes
    await expect(composer).toHaveJSProperty('scrollTop', bottom)

    // The cursor put at the very start, the view left at the bottom
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0))

    // The same tool used at the cursor
    await page.getByTitle(/^Bold/).click()

    // The view comes back up to the first line
    await expect(composer).toHaveJSProperty('scrollTop', 0)
  })

  test('leaves the view alone around a cursor already in it', async ({ page }) => {
    // The composer, open
    const composer = await openComposer(page)

    // The long draft, written in the composer
    await composer.fill(LONG_DRAFT)

    // The view a way down the draft, and the cursor on a line that shows there
    await composer.evaluate((element: HTMLTextAreaElement) => {
      // Where the thirteenth line starts, 48px under a view scrolled to 200px
      const lineStart = element.value.indexOf('Line 13')

      // The cursor at the thirteenth line's start
      element.setSelectionRange(lineStart, lineStart)

      // The view scrolled to 200px
      element.scrollTop = 200
    })

    // A tool used at the cursor
    await page.getByTitle(/^Bold/).click()

    // Bold's marks land at the start of the thirteenth line
    await expect(composer).toHaveValue(/\*\*text\*\*Line 13/)

    // The view has not moved
    await expect(composer).toHaveJSProperty('scrollTop', 200)
  })
})

/**
 * Drags the bottom edge of an editor's frame up or down.
 *
 * @param page - The page the frame is on.
 * @param frame - The frame to drag.
 * @param byPx - How far to drag the frame's bottom edge, down where positive.
 */
async function dragBottomEdge(page: Page, frame: Locator, byPx: number) {
  // Where the frame stands
  const box = await frame.boundingBox()

  // A frame not laid out has no edge to drag
  if (!box) throw new Error('The frame is not laid out')

  // The middle of the frame's bottom edge, which is where its grip sits
  const x = box.x + box.width / 2
  const y = box.y + box.height - 2

  // The pointer on the grip
  await page.mouse.move(x, y)

  // The grip held
  await page.mouse.down()

  // Moved as far as the edge is dragged
  await page.mouse.move(x, y + byPx, { steps: 5 })

  // And let go
  await page.mouse.up()
}

/**
 * Reads where an element's top and bottom edges stand.
 *
 * @param element - The element to read.
 *
 * @returns The edges, in whole pixels from the top of the screen.
 */
async function edgesOf(element: Locator) {
  // Where the element stands
  const box = await element.boundingBox()

  // An element not laid out has no edges to read
  if (!box) throw new Error('The element is not laid out')

  // The element's top and bottom edges
  return { top: Math.round(box.y), bottom: Math.round(box.y + box.height) }
}

test.describe('the frame dragged by its bottom edge', () => {
  test('grows by as much as it is dragged, and never goes under the height it opened at', async ({
    page,
  }) => {
    // The composer, open
    const composer = await openComposer(page)

    // The composer's frame, which holds the toolbar, the text and the footer
    const frame = composer.locator('xpath=../../..')

    // The frame's edges as it opens
    const opened = await edgesOf(frame)

    // The frame's bottom edge dragged down
    await dragBottomEdge(page, frame, 80)

    // The frame taller by as much as its edge was dragged. It stands on the bottom of the chat, so it is
    // its top that moved
    expect(await edgesOf(frame)).toEqual({ top: opened.top - 80, bottom: opened.bottom })

    // The frame's edge dragged back up, well past where it started
    await dragBottomEdge(page, frame, -300)

    // The frame stops at the height it opened at
    expect(await edgesOf(frame)).toEqual(opened)
  })

  test('opens as tall as the screen has room for in the expanded view, and follows the pointer', async ({
    page,
  }) => {
    // The composer, open
    await openComposer(page)

    // The composer's expanded view, open
    const expanded = await expandComposer(page)

    // The expanded view's dialog panel
    const dialog = expanded.locator('[id^="headlessui-dialog-panel"]')

    // The panel standing still once it has finished coming in
    await dialog.evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished))
    )

    // The screen the dialog opens on
    const screen = page.viewportSize()

    // A page with no viewport has no screen to measure against
    if (!screen) throw new Error('The page has no viewport')

    // The dialog's edges as it opens
    const openedDialog = await edgesOf(dialog)

    // None of the dialog off screen
    expect(openedDialog.top).toBeGreaterThanOrEqual(0)
    expect(openedDialog.bottom).toBeLessThanOrEqual(screen.height)

    // The dialog takes nearly the whole height of the screen
    expect(openedDialog.bottom - openedDialog.top).toBeGreaterThan(screen.height * 0.9)

    // The expanded view's frame, which holds both panels and the footer
    const frame = expanded.locator('textarea').locator('xpath=../../../../..')

    // The frame's edges as it opens
    const opened = await edgesOf(frame)

    // The frame's edge dragged up
    await dragBottomEdge(page, frame, -100)

    // The edge follows the pointer, and the top moves as far the other way, the dialog being held by
    // its middle
    expect(await edgesOf(frame)).toEqual({ top: opened.top + 100, bottom: opened.bottom - 100 })

    // Dragged on, far past the top of the screen
    await dragBottomEdge(page, frame, -2000)

    // The send button, which comes last in the frame
    const send = await edgesOf(expanded.getByRole('button', { name: editorCopy.submit }))

    // The frame stops at the height of its parts, the send button still inside it
    expect(send.bottom).toBeLessThanOrEqual((await edgesOf(frame)).bottom)

    // Dragged back down, far past the end of the screen
    await dragBottomEdge(page, frame, 2000)

    // The frame as tall as it opened, and no taller
    expect(await edgesOf(frame)).toEqual(opened)
  })
})

/** Where the API takes the files readers upload. */
const UPLOAD_URL = `${BACKEND_ORIGIN}/files`

/** Where the API hands out links to the files the reader uploaded themselves. */
const OWN_LINKS_URL = `${BACKEND_ORIGIN}/files/links`

/** The key the API keeps the image the tests upload under. */
const DIAGRAM_KEY = 'reader123/images/diagram.png'

/** The signed link to the stored image. */
const DIAGRAM_LINK = fileLinkTo(DIAGRAM_KEY)

/** The notice that stands while the image the tests attach is on its way. */
const UPLOADING_NOTICE = editorCopy.uploading.replace('{filename}', 'diagram')

/** The bytes most tests upload as an image: a PNG's signature with nothing after it to size the image by. */
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')

/** The image most tests hand the editor. */
const DIAGRAM: CarriedFile = {
  name: 'diagram.png',
  mimeType: 'image/png',
  buffer: PNG_SIGNATURE,
}

/** The markdown {@link DIAGRAM} is written as once stored, on a screen of one pixel per CSS pixel. */
const DIAGRAM_MARKDOWN = `![diagram](media:${DIAGRAM_KEY}?scale=100)`

/** The problem whose discussion the upload tests write in. */
const DISCUSSED_PROBLEM = 'tst-2020-1'

/** A reader with a name, which a discussion asks for before it offers a composer. */
const NAMED_READER: UserProfile = {
  graduationYear: null,
  hasLeftHighSchool: false,
  countryCode: null,
  email: null,
  username: 'Ada',
}

/**
 * Stands in for the API storing every file the page uploads, answering with the key it keeps the file under.
 *
 * @param page - The page whose uploads are answered.
 * @param key - The key the API answers with.
 *
 * @returns Every upload the API has taken, as it takes them.
 */
async function acceptUploads(page: Page, key: string = DIAGRAM_KEY): Promise<Request[]> {
  // The uploads taken so far
  const uploads: Request[] = []

  // The API, taking each upload
  await page.route(UPLOAD_URL, (route) => {
    // The upload, kept
    uploads.push(route.request())

    // The key the file is kept under
    return answerJson(route, 200, { key })
  })

  // The uploads, filling as the page makes them
  return uploads
}

/**
 * Opens a problem's discussion, whose composer's toolbar carries the image tool.
 *
 * @param page - The page the discussion is opened on.
 *
 * @returns The dialog the discussion stands in.
 */
async function openDiscussion(page: Page): Promise<Locator> {
  // A reader with a name
  await page.route(`${BACKEND_ORIGIN}/users/me/profile`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(NAMED_READER),
    })
  )

  // The library, holding the one problem
  await stubSearchAnswer(page, searchAnswerWith({ [DISCUSSED_PROBLEM]: {} }))

  // Open the library
  await page.goto(PROBLEMS_PATH)

  // The problem's row
  const row = page.locator(`[data-problem-slug="${DISCUSSED_PROBLEM}"]`)

  // Drawn once the library has settled
  await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

  // Its discussion, opened
  await row.locator(`button[title="${messages.problems.commentsButton}"]`).click()

  // The dialog the discussion stands in
  const discussion = page.getByRole('dialog')

  // Its composer, live once the reader's name has come back
  await expect(discussion.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // The discussion, ready for the reader
  return discussion
}

/**
 * Opens a problem's discussion and hands its image tool an image to upload.
 *
 * @param page - The page the discussion is opened on.
 * @param image - The image's bytes.
 *
 * @returns The composer the image's markdown is to land in.
 */
async function attachImage(page: Page, image: Buffer = PNG_SIGNATURE): Promise<Locator> {
  // The discussion, open
  const discussion = await openDiscussion(page)

  // The image tool handed the image
  await pickFile(discussion.getByTitle(editorCopy.image), { ...DIAGRAM, buffer: image })

  // Where the image is to land
  return discussion.locator('textarea')
}

test.describe('an image the editor uploads', () => {
  test('writes the markdown once the API has stored the file, sent by the reader', async ({
    page,
  }) => {
    // The API storing the file
    const uploads = await acceptUploads(page)

    // An image handed to the editor
    const composer = await attachImage(page)

    // The markdown lands in what the reader is writing, which is the whole of the upload having worked
    await expect(composer).toHaveValue(DIAGRAM_MARKDOWN)

    // And the uploading notice taken down, which nothing else would ever do
    await expect(page.getByText(UPLOADING_NOTICE)).toHaveCount(0)

    // The image sent under its own media type, which picks the API's image limits
    expect(uploads.map((upload) => upload.headers()['content-type'])).toEqual(['image/png'])

    // The upload sent as the signed-in reader
    expect(uploads[0]?.headers().authorization).toMatch(/^Bearer /)
  })

  test('scales a wide image down to the width an image starts at', async ({ page }) => {
    // The API storing the file
    await acceptUploads(page)

    // An image as wide as a Full HD screen
    const image = await blankPng(page, 1920)

    // The image handed to the editor
    const composer = await attachImage(page, image)

    // Written at a quarter of its pixels, which is 480 CSS pixels wide
    await expect(composer).toHaveValue(`![diagram](media:${DIAGRAM_KEY}?scale=25)`)
  })

  test.describe('on a Retina screen', () => {
    // A screen with two of its pixels to each CSS pixel
    test.use({ deviceScaleFactor: 2 })

    test('writes a picked image at the size its pixels have on the screen', async ({ page }) => {
      // The API storing the file
      await acceptUploads(page)

      // An image handed to the editor through its picker
      const composer = await attachImage(page)

      // Written at half its pixels, one of them to each pixel of the screen
      await expect(composer).toHaveValue(`![diagram](media:${DIAGRAM_KEY}?scale=50)`)
    })
  })

  test('writes the image where the cursor stood, the cursor left after its scale', async ({
    page,
  }) => {
    // The API storing the file
    await acceptUploads(page)

    // The discussion, open
    const discussion = await openDiscussion(page)

    // Its composer
    const composer = discussion.locator('textarea')

    // Holding a draft
    await composer.fill('ab')

    // With the cursor between the draft's two letters
    await composer.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(1, 1))

    // An image handed to the image tool
    await pickFile(discussion.getByTitle(editorCopy.image), DIAGRAM)

    // The image written between the two letters
    await expect(composer).toHaveValue(`a${DIAGRAM_MARKDOWN}b`)

    // With the cursor just before the image's closing parenthesis, where the scale can be typed over
    expect(await cursorIn(composer)).toBe(DIAGRAM_MARKDOWN.length)
  })

  test('writes a pasted image under a name of its own', async ({ page }) => {
    // The API storing the file
    await acceptUploads(page)

    // The discussion's composer
    const composer = (await openDiscussion(page)).locator('textarea')

    // A screenshot pasted, under the name a browser gives a pasted image
    await pasteFile(composer, { ...DIAGRAM, name: 'image.png' })

    // Written under the editor's own name for a pasted image
    await expect(composer).toHaveValue(
      `![${editorCopy.pastedImage}](media:${DIAGRAM_KEY}?scale=100)`
    )
  })

  test('writes an image dropped onto the composer', async ({ page }) => {
    // The API storing the file
    await acceptUploads(page)

    // The discussion's composer
    const composer = (await openDiscussion(page)).locator('textarea')

    // An image dragged in from outside the page and dropped on it
    await dropFile(composer, DIAGRAM)

    // Written under the image's own name
    await expect(composer).toHaveValue(DIAGRAM_MARKDOWN)
  })

  test('writes an attachment as a link, sent under its own type', async ({ page }) => {
    // The API storing the file as an attachment
    const uploads = await acceptUploads(page, 'reader123/attachments/notes.pdf')

    // The discussion, open
    const discussion = await openDiscussion(page)

    // A PDF handed to the attachment tool
    await pickFile(discussion.getByTitle(editorCopy.attachment), {
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    })

    // The attachment's link, under the file's whole name
    const link = '[📎 notes.pdf](media:reader123/attachments/notes.pdf)'

    // The discussion's composer
    const composer = discussion.locator('textarea')

    // The link written into it
    await expect(composer).toHaveValue(link)

    // With the cursor after the whole link
    expect(await cursorIn(composer)).toBe(link.length)

    // The file sent as a PDF, which picks the API's attachment limits
    expect(uploads.map((upload) => upload.headers()['content-type'])).toEqual(['application/pdf'])
  })

  test('opens no picker once the comment holds as many images as it takes', async ({ page }) => {
    // Every file picker the page opens
    const pickers: FileChooser[] = []
    page.on('filechooser', (picker) => pickers.push(picker))

    // The discussion, open
    const discussion = await openDiscussion(page)

    // As many images as a comment takes
    const imageLimit = 5

    // The composer, holding that many
    await discussion.locator('textarea').fill(DIAGRAM_MARKDOWN.repeat(imageLimit))

    // The image tool, pressed
    await discussion.getByTitle(editorCopy.image).click()

    // The reader is told the comment is full
    await expect(
      page.getByText(editorCopy.maxImagesReached.replace('{max}', String(imageLimit)))
    ).toBeVisible()

    // And no picker opened
    expect(pickers).toEqual([])
  })

  test('shows an uploaded image through its link, at the width its scale gives', async ({
    page,
  }) => {
    // The API storing the file
    await acceptUploads(page)

    // An image as wide as a Full HD screen
    const image = await blankPng(page, 1920)

    // The upload keys each request for the reader's own links asks for
    const askedKeys: string[][] = []

    // The API handing out the link to the reader's own image
    await page.route(OWN_LINKS_URL, (route) => {
      // The keys this request asks for, kept
      askedKeys.push(route.request().postDataJSON().keys)

      // The link to the image
      return answerJson(route, 200, { [DIAGRAM_KEY]: DIAGRAM_LINK })
    })

    // The store handing the image back at its link
    await page.route(
      (url) => url.href === DIAGRAM_LINK,
      (route) => route.fulfill({ status: 200, contentType: 'image/png', body: image })
    )

    // The image handed to the editor
    const composer = await attachImage(page, image)

    // Written at a quarter of its pixels
    await expect(composer).toHaveValue(`![diagram](media:${DIAGRAM_KEY}?scale=25)`)

    // The draft shown as it will read
    await page.getByRole('button', { name: editorCopy.preview, exact: true }).click()

    // The image the preview shows
    const shown = page.getByRole('dialog').getByRole('img', { name: 'diagram' })

    // Loaded from its link
    await expect.poll(() => naturalWidthOf(shown)).toBe(1920)

    // The link as the API handed it out, the scale read off the markdown and nothing added to it
    await expect(shown).toHaveAttribute('src', DIAGRAM_LINK)

    // Drawn 480 CSS pixels wide, a quarter of its pixels
    expect((await shown.boundingBox())?.width).toBeCloseTo(480, 0)

    // The link asked for by the image's key alone
    expect(askedKeys).toEqual([[DIAGRAM_KEY]])
  })

  test('writes nothing when the API turns the file away', async ({ page }) => {
    // The API refusing the file with nothing to say why
    await page.route(UPLOAD_URL, (route) => answerJson(route, 500, {}))

    // An image handed to the editor
    const composer = await attachImage(page)

    // The reader is told the upload failed
    await expect(page.getByText(apiErrorsCopy.SERVER_ERROR)).toBeVisible()

    // With the uploading notice taken down
    await expect(page.getByText(UPLOADING_NOTICE)).toHaveCount(0)

    // And no markdown for a file that is not there
    await expect(composer).toHaveValue('')
  })

  test('shows the coded copy when the API names what it refused on', async ({ page }) => {
    // The API refusing with a code of its own
    await page.route(UPLOAD_URL, (route) => refuse(route, 400, 'UploadTypeNotAllowed'))

    // An image handed to the editor
    await attachImage(page)

    // The code's own central copy, which only reaches the reader if the code survived the call
    await expect(page.getByText(apiErrorsCopy.UploadTypeNotAllowed)).toBeVisible()
  })
})

test.describe('a problem’s discussion', () => {
  test('opens with the cursor in its composer', async ({ page }) => {
    // The discussion, open
    const discussion = await openDiscussion(page)

    // Its composer, ready to type into with no click first
    await expect(discussion.locator('textarea')).toBeFocused()
  })
})
