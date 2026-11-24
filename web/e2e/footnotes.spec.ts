import type { Locator, Page } from '@playwright/test'

import { HARNESS_COPY, SECOND_TEXT } from '@/app/[locale]/dev/footnotes/footnotes-harness'

import slovakMessages from '../messages/sk.json'
import { expect, test } from './support/test'

/** The renderer's own copy in Slovak, which differs from the footnotes' English default. */
const editorCopy = slovakMessages.ui.editor

/** The dev page showing texts with footnotes in a dialog, in Slovak. */
const HARNESS_PATH = '/sk/dev/footnotes'

/** The page's address, which no press on a footnote link may change. */
const HARNESS_ADDRESS = new RegExp(`${HARNESS_PATH}$`)

/**
 * Opens the harness's dialog and finds the second text in it, whose footnote shares its number with the first's.
 *
 * @param page - The page.
 *
 * @returns The region holding the second text.
 */
async function openSecondText(page: Page): Promise<Locator> {
  // The harness
  await page.goto(HARNESS_PATH)

  // Its dialog, open
  await page.getByRole('button', { name: HARNESS_COPY.openDialog }).click()

  // The second text inside it
  const text = page.getByRole('dialog').getByRole('region', { name: SECOND_TEXT.title })

  // Drawn first, so a footnote a test finds out of view is really on the page
  await expect(text).toBeVisible()

  // The text, ready
  return text
}

test.describe('footnotes', () => {
  test('a mark leads to its own footnote inside the dialog and its back link returns', async ({
    page,
  }) => {
    // The second text, its footnote mark, the footnote and the footnote's back link
    const text = await openSecondText(page)
    const mark = text.getByRole('link', { name: '1', exact: true })
    const footnote = text.getByRole('listitem').filter({ hasText: SECOND_TEXT.footnote })
    const back = text.getByRole('link', {
      name: editorCopy.footnoteBack.replace('{reference}', '1'),
    })

    // The footnote starts out of view, far below the mark
    await expect(footnote).not.toBeInViewport()

    // Pressing the mark
    await mark.click()

    // This text's footnote comes into view, the back link holds the focus, and the address stays
    await expect(footnote).toBeInViewport()
    await expect(back).toBeFocused()
    await expect(page).toHaveURL(HARNESS_ADDRESS)

    // The mark is now out of view, far above
    await expect(mark).not.toBeInViewport()

    // Going back from the keyboard
    await back.press('Enter')

    // The mark comes back into view with the focus on it, and the address still stays
    await expect(mark).toBeInViewport()
    await expect(mark).toBeFocused()
    await expect(page).toHaveURL(HARNESS_ADDRESS)
  })

  test('heads the footnotes in the reader’s language', async ({ page }) => {
    // The second text
    const text = await openSecondText(page)

    // Its footnotes under the heading in Slovak
    await expect(text.getByRole('heading', { name: editorCopy.footnotes })).toBeVisible()
  })
})
