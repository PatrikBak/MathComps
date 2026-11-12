/**
 * A type no file has. Beside image types it keeps Chromium on Android off the system photo picker, so Chrome's own
 * chooser comes up instead, camera included, and its file browser still lists only images.
 */
const CAMERA_HINT_TYPE = 'android/allowCamera'

/**
 * Matches the mobile user agent of a Chromium browser on Android, which names Chrome whatever the browser's brand.
 * Firefox for Android names no Chrome, and no iOS browser names Android.
 */
const CHROMIUM_ON_ANDROID = /Android.+Chrome\//

/**
 * A browser's user agent and platform, as its {@link Navigator} reports them.
 */
export type BrowserIdentity = Pick<Navigator, 'userAgent' | 'platform'>

/**
 * The `accept` attribute a file picker goes out with, keeping the camera on offer. Since Android 14, Chromium sends a
 * picker accepting only images straight to the system photo picker, which has no camera. One type that is not an
 * image gets Chrome's own chooser, camera included. Every other browser, and every picker offering more than images,
 * takes the attribute as given.
 *
 * @param accept - The kinds of file the picker offers, as an `accept` attribute, or none for any file.
 * @param browser - The browser the picker opens in.
 *
 * @returns The attribute the picker goes out with.
 */
export function acceptKeepingCamera(
  accept: string | undefined,
  browser: BrowserIdentity
): string | undefined {
  // Any file, which the photo picker never takes
  if (accept === undefined) return accept

  // Whether every kind offered is an image, which is what sends Chromium to the photo picker
  const isImagesOnly = accept.split(',').every((type) => type.trim().startsWith('image/'))

  // Whether the user agent is Chromium's mobile one, naming Android
  const isMobileAndroid = CHROMIUM_ON_ANDROID.test(browser.userAgent)

  // Whether this is Chrome on a tablet asking for desktop sites, as big tablets do by default. Its user agent is
  // desktop Linux's, but its platform stays the Arm one Chrome reports on Android and never on a desktop
  const isDesktopSiteAndroid =
    browser.userAgent.includes('Chrome/') && browser.platform.startsWith('Linux arm')

  // A picker offering more than images, or a browser with no such photo picker, goes out as given
  if (!isImagesOnly || !(isMobileAndroid || isDesktopSiteAndroid)) return accept

  // The images, and the type that brings the camera back
  return `${accept},${CAMERA_HINT_TYPE}`
}
