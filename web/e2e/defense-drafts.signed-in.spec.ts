import type { Locator, Page } from '@playwright/test'

import { MATHILDA_NAME } from '@/constants/mathilda'

import { closeChat, SELECTION_PATH, sendTurn, transcriptOf } from './support/competitions'
import { installHostedBackend } from './support/hosted-backend'
import { SCRIPTED_REPLIES } from './support/hosted-backend-content'
import { isKeptInStorage } from './support/interaction'
import { BILINGUAL, rememberedSelection, stubSelection } from './support/problem-selection'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** What a reviewer writes to Mathilda about the problem. */
const DRAFT = 'Pairing the moves up leaves the second player an answer to every one'

/**
 * Opens Mathilda on {@link BILINGUAL}, a problem proposed for the competitions' papers, and waits until her composer
 * takes text.
 *
 * @param page - The page the problem is open on.
 *
 * @returns The composer.
 */
async function openOnProposal(page: Page): Promise<Locator> {
  // Her button on the problem
  await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

  // The composer, the one text box on the page while the chat is open
  const composer = page.locator('textarea')

  // Live once it takes text
  await expect(composer).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

  // Handed back for the turn to be written in
  return composer
}

test.describe("Mathilda's unsent turn", () => {
  test.beforeEach(async ({ page }) => {
    // The backend the chat talks to, which keeps what is said to Mathilda
    const chat = await installHostedBackend(page, 'ready')

    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection', rememberedSelection(chat))

    // The problem, open
    await page.goto(`${SELECTION_PATH}?problem=${BILINGUAL.id}`)
  })

  test('waits in the composer through closing the chat and a reload', async ({ page }) => {
    // The chat, open
    const composer = await openOnProposal(page)

    // Half an argument, written and never sent
    await composer.fill(DRAFT)

    // Kept before the chat goes
    await expect.poll(() => isKeptInStorage(page, DRAFT), { timeout: SETTLE_TIMEOUT_MS }).toBe(true)

    // The chat closed, which takes the composer off the page
    await closeChat(page)

    // Where the argument is waiting once the chat opens again
    await expect(await openOnProposal(page)).toHaveValue(DRAFT, { timeout: SETTLE_TIMEOUT_MS })

    // A stray reload
    await page.reload()

    // Still waiting after it
    await expect(await openOnProposal(page)).toHaveValue(DRAFT, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('is forgotten once it goes out', async ({ page }) => {
    // The chat, open
    await openOnProposal(page)

    // The argument, sent
    await sendTurn(page, DRAFT)

    // Answered, so it went out
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Kept nowhere, so a reload brings back an empty composer
    await expect
      .poll(() => isKeptInStorage(page, DRAFT), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(false)
  })
})
