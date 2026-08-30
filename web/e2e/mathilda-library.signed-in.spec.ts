import type { Page } from '@playwright/test'

import { MATHILDA_NAME } from '@/constants/mathilda'

import {
  actionsCopy,
  areaCopy,
  areaPath,
  chatCopy,
  LIST_PATH,
  sendTurn,
} from './support/competitions'
import { COMPETITION_ID, installHostedBackend } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** The season every conversation the fake holds reads as having been set in. */
const SEASON_YEARS = '2026/2027'

/** What the run that grades nobody is called. */
const PRACTICE_NAME = 'Practice competition'

/**
 * Opens the student's own list of conversations from the user menu.
 *
 * @param page - The page it is being opened on.
 *
 * @returns The list, once its rows are on screen.
 */
async function openLibrary(page: Page) {
  // The menu the list hangs off
  await page.locator('#user-menu-trigger').click()

  // And the list itself, which the menu offers by her name
  await page.getByRole('menuitem', { name: MATHILDA_NAME }).click()

  // The list, once it has rows to read
  const library = page.getByRole('dialog')
  await expect(library.getByText(SEASON_YEARS).first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

  // Ready to be acted on
  return library
}

test.describe("the student's own list of conversations", () => {
  test('names a competition conversation the way its own area names it', async ({ page }) => {
    // A student who has argued a competition problem, on the competition itself
    await installHostedBackend(page, 'running')
    await page.goto(areaPath(COMPETITION_ID))

    // What that competition is called, read off the page that is inside it
    const competitionName = await page
      .getByRole('heading', { level: 1 })
      .innerText({ timeout: SETTLE_TIMEOUT_MS })

    // The row their most recent conversation reads on
    const library = await openLibrary(page)
    const row = library.getByRole('button').filter({ hasText: SEASON_YEARS }).first()

    // Which names the competition and the problem, neither of which the reader's own side could name
    await expect(row).toContainText(competitionName)
    await expect(row).toContainText('Problem 1')
  })

  test('offers no way to drop a graded conversation, and keeps offering it elsewhere', async ({
    page,
  }) => {
    // A student holding conversations of both kinds
    await installHostedBackend(page, 'running')
    await page.goto(LIST_PATH)

    // Their list, on which a competition row sits above a handout one
    const library = await openLibrary(page)
    const competitionRow = library.getByRole('button').filter({ hasText: SEASON_YEARS }).first()
    const handoutRow = library.getByRole('button').filter({ hasText: chatCopy.deletedHandout })

    // The way back to where it was argued is what the row offers
    await expect(
      competitionRow.locator('..').getByRole('link', { name: areaCopy.goToArea })
    ).toBeVisible()

    // And what a student argued under their entry outlives their opinion of it, so nothing offers to drop it
    await expect(
      competitionRow.locator('..').getByRole('button', { name: chatCopy.deleteSession })
    ).toHaveCount(0)

    // Which is the competition's own rule rather than the list having lost the control
    await expect(
      handoutRow.locator('..').getByRole('button', { name: chatCopy.deleteSession })
    ).toBeVisible()
  })

  test('drops a practice conversation off the list, which grades nobody', async ({ page }) => {
    // A student with an entry still to spend, and graded conversations already behind them
    await installHostedBackend(page, 'ready')

    // Open the list, where the practice run is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // A conversation held about the first problem of the practice set
    await page
      .getByRole('button', { name: areaCopy.startDefense })
      .first()
      .click({ timeout: SETTLE_TIMEOUT_MS })
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // What the student argues, which is what the conversation is saved under
    await sendTurn(page, 'Every residue class is hit, so the bound is tight')
    await expect(page.getByLabel(chatCopy.transcriptLabel)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Out of the competition, back to where the list is reached from
    await page.goto(LIST_PATH)

    // Their list, and the row the practice conversation reads on among the graded ones behind it
    const library = await openLibrary(page)
    const practiceRows = library.getByRole('button').filter({ hasText: PRACTICE_NAME })
    await expect(practiceRows).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS })

    // Which the list offers to drop, the student not being graded on the run it was argued under
    await practiceRows.locator('..').getByRole('button', { name: chatCopy.deleteSession }).click()

    // Confirmed, since a drop is not taken back
    await page.getByRole('button', { name: actionsCopy.confirm }).click()

    // Leaving the list without it, and the graded rows behind it untouched
    await expect(practiceRows).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })
    await expect(library.getByRole('button').filter({ hasText: SEASON_YEARS })).not.toHaveCount(0)
  })

  test('opens a competition conversation on the terms its own area opens it on', async ({
    page,
  }) => {
    // A student whose entry is still running
    await installHostedBackend(page, 'running')
    await page.goto(LIST_PATH)

    // Opening the conversation from the list rather than from the competition
    const library = await openLibrary(page)
    await library.getByRole('button').filter({ hasText: SEASON_YEARS }).first().click()

    // Which reads under the same clock the area reads it under
    await expect(library.getByText(/\d+ min/)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And offers nothing that could rewrite what was argued
    await expect(library.getByRole('button', { name: chatCopy.newDefense })).toHaveCount(0)
    await expect(library.getByRole('button', { name: chatCopy.deleteSession })).toHaveCount(0)
  })
})
