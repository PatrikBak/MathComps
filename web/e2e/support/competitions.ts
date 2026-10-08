import type { Locator, Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../../messages/en.json'
import { expect } from './test'

/**
 * The copy the assertions match on, taken from the app's own English messages: what each of them means is
 * that a particular message is on screen, not that a particular sentence is.
 */
const {
  apiErrors: apiErrorMessages,
  auth: authMessages,
  competitions: competitionsCopy,
  defense: defenseCopy,
  ui,
} = messages

/** The copy every failure code resolves to, whichever call earned it. */
export const apiErrorsCopy = apiErrorMessages

/** The copy the competitions surface reads under. */
export const areaCopy = competitionsCopy

/** The copy every prompt for an account reads under, whichever surface raises it. */
export const authCopy = authMessages

/** The copy the defense chat reads under. */
export const chatCopy = defenseCopy

/** The labels every shared control reads under, whichever surface it is on. */
export const actionsCopy = ui.actions

/** The chrome every modal carries, whatever it is holding. */
export const modalCopy = ui.modal

/** The labels the rich editor's own controls read under, on whichever surface it is embedded. */
export const editorCopy = ui.editor

/** The labels the header's user menu reads under. */
export const userMenuCopy = ui.userMenu

/**
 * The competitions list in English, which is the canonical locale and so carries no route translation.
 */
export const LIST_PATH = `/en${ROUTES.COMPETITIONS}`

/**
 * The problem selection in English, which is the canonical locale and so carries no route translation.
 */
export const SELECTION_PATH = `/en${ROUTES.PROBLEM_SELECTION}`

/**
 * One competition's own area.
 *
 * @param competitionSlug - Which competition's area.
 *
 * @returns The path.
 */
export function areaPath(competitionSlug: string): string {
  // An area hangs off the list under the competition's own name
  return `${LIST_PATH}/${competitionSlug}`
}

/** How long the list gets to draw its rounds before one is looked for among them. */
const ROUNDS_TIMEOUT_MS = 15_000

/**
 * Brings the round holding something on the list into view: its school year picked from the menu while
 * another one is showing, then the round's own tab.
 *
 * The list shows one round at a time and draws the rounds of one school year, so anything in another
 * round is hidden, and anything in another school year is not on the page at all.
 *
 * @param page - The page the list is open on.
 * @param target - Something inside the round, such as a competition's row or a link it offers.
 */
export async function showRoundHolding(page: Page, target: Locator): Promise<void> {
  // The rounds, once the list has drawn them
  await expect(page.getByRole('tablist', { name: competitionsCopy.rounds })).toBeVisible({
    timeout: ROUNDS_TIMEOUT_MS,
  })

  // The menu of school years, which the list offers once there is more than one
  const yearMenu = page.getByRole('button', { name: competitionsCopy.schoolYear, exact: true })

  // Every school year on offer, none while the list holds a single one
  const years = (await yearMenu.count()) === 0 ? [] : await readSchoolYears(page, yearMenu)

  // Each year in turn, until one draws the target
  for (const year of years) {
    // Drawn in the year showing
    if ((await target.count()) > 0) break

    // The menu, opened
    await yearMenu.click()

    // That year, picked from it
    await page.getByRole('menuitemcheckbox', { name: year, exact: true }).click()

    // Once the list shows it
    await expect(yearMenu).toHaveText(year)
  }

  // The tab of the round whose panel holds the target
  const tabId = await target
    .first()
    .locator('xpath=ancestor::*[@role="tabpanel"][1]')
    .getAttribute('aria-labelledby')

  // Picked
  await page.locator(`[id="${tabId}"]`).click()
}

/**
 * Reads the school years the list's menu offers.
 *
 * @param page - The page the list is open on.
 * @param yearMenu - The button opening the menu.
 *
 * @returns The years as the menu names them, newest first.
 */
async function readSchoolYears(page: Page, yearMenu: Locator): Promise<string[]> {
  // The menu, opened
  await yearMenu.click()

  // The years it lists
  const items = page.getByRole('menuitemcheckbox')

  // Once drawn
  await expect(items.first()).toBeVisible()

  // Every one of them by name
  const years = await items.allTextContents()

  // The menu, shut again
  await page.keyboard.press('Escape')

  // The years
  return years
}

/**
 * The transcript of the open conversation.
 *
 * Matched on its role as well as its name: the chat also carries a "New conversation" button, whose
 * accessible name holds the transcript's own, so a name alone resolves to both.
 *
 * @param page - The page the conversation is open on.
 *
 * @returns The transcript.
 */
export function transcriptOf(page: Page): Locator {
  // The transcript, matched on its role so the new-conversation button does not answer to it
  return page.getByRole('log', { name: chatCopy.transcriptLabel })
}

/**
 * Opens the chat on a problem's most recent conversation.
 *
 * @param within - The page it is being opened on, or the one problem on it whose conversation to open.
 */
export async function openExistingDefense(within: Page | Locator): Promise<void> {
  // The row of the conversation it opens, addressed by the conversation's own id
  await within.locator('[data-defense-session-id]').first().click()
}

/**
 * Closes the open chat and waits until it is gone, so a chat opened next is a new one rather than this one
 * coming back mid-exit.
 *
 * @param page - The page the chat is open on.
 */
export async function closeChat(page: Page): Promise<void> {
  // The keyboard path, which is how a student leaves without reaching for the mouse
  await page.keyboard.press('Escape')

  // All the way out
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/**
 * How far ahead of the page's own clock a pause is set, so the call cannot land in its own past.
 */
const PAUSE_CUSHION_MS = 500

/**
 * Stops the page's clock where it stands, so nothing in flight lands until the spec walks it forward.
 *
 * @param page - The page whose clock to hold.
 */
export async function holdClock(page: Page): Promise<void> {
  // Where the page's own clock currently is
  const at = await page.evaluate(() => Date.now())

  // Held a moment ahead of it: the pause is refused outright if the instant it names has already gone by
  // while the instruction was on its way over
  await page.clock.pauseAt(at + PAUSE_CUSHION_MS)
}

/**
 * Writes one turn and sends it.
 *
 * @param page - The page it is being written on.
 * @param text - What the turn says.
 */
export async function sendTurn(page: Page, text: string): Promise<void> {
  // The composer, which is the only editable thing in the open chat
  await page.locator('textarea').fill(text)

  // The keyboard path, which is how a student sends a turn without reaching for the mouse
  await page.keyboard.press('Meta+Enter')
}
