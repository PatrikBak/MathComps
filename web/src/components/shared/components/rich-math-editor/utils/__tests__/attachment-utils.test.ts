import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EDITOR_UPLOADS, imageScaleOf } from '../attachment-utils'

/** The folder this test file sits in */
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))

/** A macOS Retina screenshot 4 pixels wide, stamped 144 DPI */
const RETINA_SCREENSHOT = path.join(
  TEST_DIR,
  '../../../../utils/__tests__/fixtures/macos-retina-screenshot.png'
)

describe('imageScaleOf', () => {
  it('reads a stamp of a whole number of 72s, up to a 3x screen, as the screen it names', () => {
    // A Retina stamp, and a 3x one, on narrow images uploaded from a plain screen
    expect(imageScaleOf({ dpi: 144, screenDensity: 1, pixelWidth: 400 })).toBe(50)
    expect(imageScaleOf({ dpi: 216, screenDensity: 1, pixelWidth: 400 })).toBe(33)

    // The 96 Windows stamps on everything, a scanner's 150, and a stamp past the densest screen name none
    expect(imageScaleOf({ dpi: 96, screenDensity: 1, pixelWidth: 400 })).toBe(100)
    expect(imageScaleOf({ dpi: 150, screenDensity: 1, pixelWidth: 400 })).toBe(100)
    expect(imageScaleOf({ dpi: 288, screenDensity: 1, pixelWidth: 400 })).toBe(100)
  })

  it('goes by the denser of the screen the stamp names and the one the image is uploaded from', () => {
    // An image stamped by no screen, uploaded from a Retina one, and from one scaled to 150%
    expect(imageScaleOf({ dpi: null, screenDensity: 2, pixelWidth: 400 })).toBe(50)
    expect(imageScaleOf({ dpi: null, screenDensity: 1.5, pixelWidth: 400 })).toBe(66)

    // A Retina capture, uploaded from a screen scaled to 150%, and from a 3x one
    expect(imageScaleOf({ dpi: 144, screenDensity: 1.5, pixelWidth: 400 })).toBe(50)
    expect(imageScaleOf({ dpi: 144, screenDensity: 3, pixelWidth: 400 })).toBe(33)
  })

  it('starts a wide image no wider than 480 CSS pixels', () => {
    // An image exactly that wide, and one a pixel wider
    expect(imageScaleOf({ dpi: null, screenDensity: 1, pixelWidth: 480 })).toBe(100)
    expect(imageScaleOf({ dpi: null, screenDensity: 1, pixelWidth: 481 })).toBe(99)

    // A Retina capture 1920 pixels wide, whose width brings it further down than its stamp does
    expect(imageScaleOf({ dpi: 144, screenDensity: 2, pixelWidth: 1920 })).toBe(25)
  })

  it('never blows an image up past its own pixels', () => {
    // An image uploaded from a page zoomed out past one screen pixel per CSS pixel
    expect(imageScaleOf({ dpi: null, screenDensity: 0.8, pixelWidth: 400 })).toBe(100)
  })
})

describe('the markdown an uploaded image is written as', () => {
  afterEach(() => {
    // The test run's own globals, back in place
    vi.unstubAllGlobals()
  })

  it('writes a Retina screenshot at the scale its own stamp gives', async () => {
    // A decoder reading the screenshot's 4 pixels of width, which the test run has none of
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4, close: () => {} }))

    // The screenshot, handed to the editor as a file
    const file = new File([fs.readFileSync(RETINA_SCREENSHOT)], 'Screenshot.png', {
      type: 'image/png',
    })

    // Its markdown once stored, uploaded from a plain screen
    const markdown = await EDITOR_UPLOADS.image.toMarkdown({
      file,
      name: 'Screenshot',
      key: 'images/shot.png',
      screenDensity: 1,
    })

    // Written at half its pixels, which is the size it had on the screen it was taken on
    expect(markdown).toBe('![Screenshot](media:images/shot.png?scale=50)')
  })
})
