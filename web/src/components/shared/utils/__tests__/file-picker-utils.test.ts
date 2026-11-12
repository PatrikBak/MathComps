import { describe, expect, it } from 'vitest'

import { acceptKeepingCamera, type BrowserIdentity } from '../file-picker-utils'

/** The user agent Chrome sends from desktop Linux, and from an Android tablet asking for desktop sites. */
const DESKTOP_LINUX_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Chrome on an Android phone. */
const CHROME_ANDROID: BrowserIdentity = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv81',
}

/** Chrome on an Android tablet asking for desktop sites, as big tablets do by default. */
const CHROME_ANDROID_DESKTOP_SITE: BrowserIdentity = {
  userAgent: DESKTOP_LINUX_CHROME,
  platform: 'Linux armv81',
}

/** Firefox on an Android phone. */
const FIREFOX_ANDROID: BrowserIdentity = {
  userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  platform: 'Linux armv8l',
}

/** Chrome on an iPhone, which runs on WebKit like every iOS browser. */
const CHROME_IPHONE: BrowserIdentity = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
    'CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
}

/** Chrome on a Mac. */
const CHROME_MAC: BrowserIdentity = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 ' +
    'Safari/537.36',
  platform: 'MacIntel',
}

/** Chrome on desktop Linux. */
const CHROME_LINUX: BrowserIdentity = {
  userAgent: DESKTOP_LINUX_CHROME,
  platform: 'Linux x86_64',
}

describe('acceptKeepingCamera', () => {
  it.each([
    ['Chrome on an Android phone', CHROME_ANDROID],
    ['Chrome on an Android tablet asking for desktop sites', CHROME_ANDROID_DESKTOP_SITE],
  ])('brings the camera back to a picker of images on %s', (_description, browser) => {
    // The images, and the type no file has
    expect(acceptKeepingCamera('image/*', browser)).toBe('image/*,android/allowCamera')
  })

  it.each([
    ['Firefox on Android', FIREFOX_ANDROID],
    ['Chrome on an iPhone', CHROME_IPHONE],
    ['Chrome on a Mac', CHROME_MAC],
    ['Chrome on desktop Linux', CHROME_LINUX],
  ])('leaves a picker of images as it is on %s', (_description, browser) => {
    // The images alone, as given
    expect(acceptKeepingCamera('image/*', browser)).toBe('image/*')
  })

  it('counts every image type in a list, spaces and all', () => {
    // The attribute for two image types, written with a space between them
    const accept = acceptKeepingCamera('image/png, image/jpeg', CHROME_ANDROID)

    // Both, and the type no file has
    expect(accept).toBe('image/png, image/jpeg,android/allowCamera')
  })

  it('leaves a picker of images and a document as it is on Chrome on Android', () => {
    // A picker Chrome never sends to its photo picker, as given
    expect(acceptKeepingCamera('image/*,application/pdf', CHROME_ANDROID)).toBe(
      'image/*,application/pdf'
    )
  })
})
