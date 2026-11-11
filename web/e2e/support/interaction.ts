import type { JSHandle, Locator, Page } from '@playwright/test'
import jsQR from 'jsqr'

import messages from '../../messages/en.json'
import { expect } from './test'

/** The labels the header's user menu reads under. */
export const userMenuCopy = messages.ui.userMenu

/** How many pixels across a QR is drawn at to be read. */
const QR_READ_SIDE = 512

/** How long sign-in has to settle before the header's user menu is called missing. */
const SIGN_IN_TIMEOUT_MS = 15_000

/**
 * Opens the header's user menu once the page is up.
 *
 * @param page - The page it is opened on.
 */
export async function openUserMenu(page: Page): Promise<void> {
  // The menu's button
  const userMenu = page.getByRole('button', { name: userMenuCopy.label })

  // Drawn once sign-in has settled
  await expect(userMenu).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })

  // Opened
  await userMenu.click()
}

/**
 * Whether an element shows the ring a browser draws around focus it lets the reader see.
 *
 * @param element - The element.
 *
 * @returns Whether it does.
 */
export function showsFocusRing(element: Locator): Promise<boolean> {
  // Read off the element itself
  return element.evaluate((node) => node.matches(':focus-visible'))
}

/**
 * The selected tab of a strip of tabs.
 *
 * @param page - The page.
 * @param tabsLabel - What the strip of tabs is called.
 *
 * @returns The tab.
 */
export function selectedTab(page: Page, tabsLabel: string) {
  // The selected tab of the strip
  return page.getByRole('tablist', { name: tabsLabel }).getByRole('tab', { selected: true })
}

/**
 * How far down the window is scrolled.
 *
 * @param page - The page.
 *
 * @returns The scroll, in pixels from the top.
 */
export function windowScroll(page: Page): Promise<number> {
  // Read off the window itself
  return page.evaluate(() => window.scrollY)
}

/**
 * Closes the open menu from the keyboard and waits until it has finished closing, which is when it hands the focus
 * back to the button that opened it. That hand-back scrolls the page to the button, so a step taken before it can find
 * the page moved under it.
 *
 * @param menuButton - The button that opened the menu.
 */
export async function closeMenuFromKeyboard(menuButton: Locator): Promise<void> {
  // The menu, closed from the keyboard
  await menuButton.page().keyboard.press('Escape')

  // Closed for good once the focus is back on its button
  await expect(menuButton).toBeFocused()
}

/**
 * Whether any value the page's storage keeps holds a text, as a draft kept for the reader's return does.
 *
 * @param page - The page.
 * @param text - The text.
 *
 * @returns Whether it is kept.
 */
export function isKeptInStorage(page: Page, text: string): Promise<boolean> {
  // Read off every value the page's storage keeps
  return page.evaluate(
    (sought) => Object.values(window.localStorage).some((value) => value.includes(sought)),
    text
  )
}

/**
 * Leaves a value in the page's storage before the page loads, as an earlier visit in the same browser would.
 *
 * @param page - The page, not yet opened.
 * @param key - Where the value is kept.
 * @param value - What is kept there.
 */
export async function leaveInStorage(page: Page, key: string, value: string): Promise<void> {
  // Set in the browser's storage before the page's own scripts run
  await page.addInitScript(
    ({ storageKey, storedValue }) => window.localStorage.setItem(storageKey, storedValue),
    { storageKey: key, storedValue: value }
  )
}

/**
 * How far down the window could be scrolled at most, which is how much taller the page is than the window.
 *
 * @param page - The page.
 *
 * @returns The furthest scroll, in pixels from the top.
 */
export function furthestScroll(page: Page): Promise<number> {
  // The page's height past the window's
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
}

/**
 * How far below the view's top an element stands.
 *
 * @param element - The element.
 *
 * @returns The distance, in pixels, negative for an element starting above the view.
 */
export function topInView(element: Locator): Promise<number> {
  // Read off the element itself
  return element.evaluate((node) => node.getBoundingClientRect().top)
}

/**
 * Whether a floating panel has been sized and placed: it shows, everything it holds lies inside it, and it covers
 * none of the element it opened from. A panel scrolling what it holds never reads as placed.
 *
 * @param panel - The floating panel, which may not be on the page.
 * @param opener - The element the panel opened from.
 *
 * @returns Whether the panel shows, sized to what it holds and clear of its opener.
 */
export async function isPanelPlaced(panel: Locator, opener: Locator): Promise<boolean> {
  // How far, in pixels, two edges may disagree and still count as one, since a scaled box lands between pixels
  const SUBPIXEL_SLACK_PX = 1

  // Where the opener stands
  const openerBox = await opener.boundingBox()

  // An opener off the page has nothing to stand clear of
  if (openerBox === null) return false

  // The panel read in one go, so its box and its content's come from the same moment
  return panel.evaluateAll(
    (panels, { opener, slack }) => {
      // A panel not on the page, or one the locator cannot single out, is not placed
      if (panels.length !== 1) return false

      // The panel's box
      const box = panels[0].getBoundingClientRect()

      // Whether everything the panel holds lies inside it, to within rounding
      const holdsAllInside = Array.from(panels[0].querySelectorAll('*'), (child) =>
        child.getBoundingClientRect()
      ).every(
        (childBox) =>
          childBox.top >= box.top - slack &&
          childBox.bottom <= box.bottom + slack &&
          childBox.left >= box.left - slack &&
          childBox.right <= box.right + slack
      )

      // Whether the panel shares no area with its opener
      const isClearOfOpener =
        box.bottom <= opener.y ||
        box.top >= opener.y + opener.height ||
        box.right <= opener.x ||
        box.left >= opener.x + opener.width

      // Placed once both hold
      return holdsAllInside && isClearOfOpener
    },
    { opener: openerBox, slack: SUBPIXEL_SLACK_PX }
  )
}

/**
 * Where the cursor stands in a textarea.
 *
 * @param textarea - The textarea.
 *
 * @returns How many characters precede the cursor.
 */
export function cursorIn(textarea: Locator): Promise<number> {
  // Read off the textarea itself
  return textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)
}

/**
 * Puts the cursor at a place in a textarea.
 *
 * @param textarea - The textarea.
 * @param offset - How many characters are to precede the cursor.
 */
export async function putCursorAt(textarea: Locator, offset: number): Promise<void> {
  // Set on the textarea itself
  await textarea.evaluate((node: HTMLTextAreaElement, at) => node.setSelectionRange(at, at), offset)
}

/**
 * Puts the cursor in a textarea right after the first place a text stands in it.
 *
 * @param textarea - The textarea.
 * @param text - The text the cursor is to follow.
 */
export async function putCursorAfter(textarea: Locator, text: string): Promise<void> {
  // Set on the textarea itself
  await textarea.evaluate((node: HTMLTextAreaElement, preceding) => {
    // Where the text ends
    const offset = node.value.indexOf(preceding) + preceding.length

    // The cursor at the text's end
    node.setSelectionRange(offset, offset)
  }, text)
}

/**
 * How many pixels wide an image's file is, which is none until it has loaded.
 *
 * @param image - The image.
 *
 * @returns The file's width in pixels.
 */
export function naturalWidthOf(image: Locator): Promise<number> {
  // Read off the image itself
  return image.evaluate((node: HTMLImageElement) => node.naturalWidth)
}

/**
 * Scrolls the window to a spot, handing back once the scroll has been dispatched, as a reader's own scroll
 * always is before their next click.
 *
 * @param page - The page.
 * @param top - The spot, in pixels from the top.
 */
export async function scrollWindowTo(page: Page, top: number): Promise<void> {
  // Scrolled there, and waited on until the page has heard it
  await page.evaluate(
    (spot) =>
      new Promise<void>((resolve) => {
        // Where the window stands before the jump
        const from = window.scrollY

        // Handed back once the scroll is heard
        window.addEventListener('scroll', () => resolve(), { once: true })

        // Jumped there, since the site otherwise scrolls smoothly
        window.scrollTo({ top: spot, behavior: 'instant' })

        // Handed back at once by a window that stood there already, since staying put raises no scroll
        if (window.scrollY === from) resolve()
      }),
    top
  )

  // There, which a page too short for the spot would have cut short
  expect(await windowScroll(page)).toBe(top)
}

/**
 * Waits until the page is two frames on, by which time it has painted whatever the last step set off.
 *
 * @param page - The page.
 */
export async function twoFramesLater(page: Page): Promise<void> {
  // Waited out inside the page
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // The next frame, and the one after it
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )
}

/**
 * Clicks a link where it sits. Playwright's own click scrolls its target into view first, which would move the
 * very spot a test is measuring.
 *
 * @param page - The page.
 * @param name - The link's accessible name, or a part of it.
 */
export async function clickInPlace(page: Page, name: string): Promise<void> {
  // A plain click, fired on the link itself
  await page.getByRole('link', { name }).evaluate((element: HTMLElement) => element.click())
}

/**
 * Clicks a link twice where it sits, the second click landing before the page has answered the first.
 *
 * @param link - The link.
 */
export async function clickTwiceAtOnce(link: Locator): Promise<void> {
  // Both clicks, fired on the link itself in one go
  await link.evaluate((element: HTMLElement) => {
    // The first click
    element.click()

    // And the second, before anything has rendered
    element.click()
  })
}

/** How long a long press is held down, with room to spare over the shortest hold the app counts as one. */
export const LONG_PRESS_MS = 800

/**
 * Holds a finger on an element long enough to count as a long press, then lifts it.
 *
 * @param page - The page.
 * @param target - What the finger lands on.
 */
export async function longPressByTouch(page: Page, target: Locator): Promise<void> {
  // Scrolled into view, since the finger has to land on it
  await target.scrollIntoViewIfNeeded()

  // Where the element sits
  const box = (await target.boundingBox())!

  // The browser's own touch input, the only way to hold a finger down rather than tap
  const touch = await page.context().newCDPSession(page)

  // A finger put down on its middle
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  })

  // Held there
  await page.waitForTimeout(LONG_PRESS_MS)

  // And lifted
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Has the page draw a blank PNG, which every browser decodes.
 *
 * @param page - The page drawing the image.
 * @param width - How many pixels wide the image is.
 * @param height - How many pixels high the image is.
 *
 * @returns The image's bytes.
 */
export async function blankPng(page: Page, width: number, height: number): Promise<Buffer> {
  // The image as a data URL, drawn on a canvas that size
  const dataUrl = await page.evaluate(
    ([canvasWidth, canvasHeight]) => {
      // A canvas that size
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // Its blank pixels, encoded as a PNG
      return canvas.toDataURL('image/png')
    },
    [width, height]
  )

  // The bytes the data URL carries after its header
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

/**
 * Reads what a QR the page draws says, as a phone's camera pointed at the screen reads it.
 *
 * @param qr - The QR, an SVG on the page.
 *
 * @returns The text the QR carries.
 */
export async function readQrCode(qr: Locator): Promise<string> {
  // The QR's pixels, drawn at the size it is read at
  const pixels = await qr.evaluate(async (svg, side) => {
    // The QR as an image of its own
    const image = new Image()
    image.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`

    // Once the browser has drawn it
    await image.decode()

    // A canvas that size
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side

    // Its drawing surface
    const surface = canvas.getContext('2d')

    // Every browser this suite runs has one
    if (surface === null) throw new Error('The browser drew no canvas.')

    // The QR drawn across the canvas
    surface.drawImage(image, 0, 0, side, side)

    // Its pixels, four bytes each, carried out of the page as plain numbers
    return Array.from(surface.getImageData(0, 0, side, side).data)
  }, QR_READ_SIDE)

  // What the QR says, read off those pixels
  const read = jsQR(Uint8ClampedArray.from(pixels), QR_READ_SIDE, QR_READ_SIDE)

  // A QR nothing can read is a broken QR
  if (read === null) throw new Error('The QR could not be read.')

  // Its text
  return read.data
}

/**
 * A file a test hands the page through a picker, a paste or a drop, in the shape Playwright's own file inputs
 * take one.
 */
export type CarriedFile = {
  /** The file's name */
  name: string
  /** The file's media type */
  mimeType: string
  /** The file's bytes */
  buffer: Buffer
}

/**
 * Presses a control that opens the file picker, and hands the picker a file, or several picked together.
 *
 * @param control - The control.
 * @param files - The file the picker is handed, or the files.
 */
export async function pickFile(
  control: Locator,
  files: CarriedFile | CarriedFile[]
): Promise<void> {
  // The file picker the control is about to open
  const picker = control.page().waitForEvent('filechooser')

  // The control, pressed
  await control.click()

  // The picker handed the files
  await (await picker).setFiles(files)
}

/**
 * Builds, in the page, the data a paste or a drag carries: the file and nothing else.
 *
 * @param page - The page the data is built in.
 * @param file - The file it carries.
 *
 * @returns A handle on the data.
 */
function transferOf(page: Page, file: CarriedFile): Promise<JSHandle<DataTransfer>> {
  // The data, holding the file
  return page.evaluateHandle(
    ({ name, mimeType, bytes }) => {
      // An empty transfer
      const transfer = new DataTransfer()

      // The file added to it
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type: mimeType }))

      // The transfer, carrying the file
      return transfer
    },
    { name: file.name, mimeType: file.mimeType, bytes: [...file.buffer] }
  )
}

/**
 * Pastes a file onto an element the way the browser hands a paste to the page, the clipboard holding the file
 * alone, as it holds a screenshot.
 *
 * @param target - The element the paste lands on.
 * @param file - The file the clipboard holds.
 */
export async function pasteFile(target: Locator, file: CarriedFile): Promise<void> {
  // The clipboard, holding the file
  const clipboard = await transferOf(target.page(), file)

  // The paste, landing on the element, whose handlers have all run by the time this hands back
  await target.evaluate(
    (element, clipboardData) =>
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
      ),
    clipboard
  )
}

/**
 * Drags a file in from outside the page and lets go of it over an element.
 *
 * @param target - The element the file is dropped on.
 * @param file - The file dragged in.
 */
export async function dropFile(target: Locator, file: CarriedFile): Promise<void> {
  // What the drag carries
  const dataTransfer = await transferOf(target.page(), file)

  // The drag coming in over the element
  await target.dispatchEvent('dragenter', { dataTransfer })

  // And moving across it
  await target.dispatchEvent('dragover', { dataTransfer })

  // And the file let go on it
  await target.dispatchEvent('drop', { dataTransfer })
}
