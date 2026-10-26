import type { Locator, Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../../messages/en.json'
import { MATHCOMPS_ORGANIZATION_SLUG } from './selection-writes'
import { expect } from './test'

// The copy the assertions match on, taken from the app's own English messages: each assertion means that a
// particular message is on screen, not that a particular sentence is

/** The copy every failure code resolves to, whichever call earned it. */
export const apiErrorsCopy = messages.apiErrors

/** The copy the competitions surface reads under. */
export const areaCopy = messages.competitions

/** The copy every prompt for an account reads under, whichever surface raises it. */
export const authCopy = messages.auth

/** The copy the defense chat reads under. */
export const chatCopy = messages.defense

/** The labels every shared control reads under, whichever surface it is on. */
export const actionsCopy = messages.ui.actions

/** The chrome every modal carries, whatever it is holding. */
export const modalCopy = messages.ui.modal

/** The labels the rich editor's own controls read under, on whichever surface it is embedded. */
export const editorCopy = messages.ui.editor

/** The labels the header's user menu reads under. */
export const userMenuCopy = messages.ui.userMenu

/**
 * The competitions list in English, which is the canonical locale and so carries no route translation.
 */
export const LIST_PATH = `/en${ROUTES.COMPETITIONS}`

/**
 * One organization's problem selection in English, which is the canonical locale and so carries no route
 * translation.
 *
 * @param organization - The organization's slug.
 *
 * @returns The path.
 */
export function selectionPath(organization: string): string {
  // The selection's route, naming the organization
  return `/en${ROUTES.ORGANIZATION_SELECTION.replace('[slug]', organization)}`
}

/**
 * MathComps' problem selection in English.
 */
export const SELECTION_PATH = selectionPath(MATHCOMPS_ORGANIZATION_SLUG)

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
  await expect(page.getByRole('tablist', { name: areaCopy.rounds })).toBeVisible({
    timeout: ROUNDS_TIMEOUT_MS,
  })

  // The menu of school years, which the list offers once there is more than one
  const yearMenu = page.getByRole('button', { name: areaCopy.schoolYear, exact: true })

  // Every school year on offer, none while the list holds a single one
  const years = (await yearMenu.count()) === 0 ? [] : await readSchoolYears(page, yearMenu)

  // Each year in turn, until one draws the target
  for (const year of years) {
    // The target, already drawn in the year showing
    if ((await target.count()) > 0) break

    // The menu, opened
    await yearMenu.click()

    // The year, picked from the menu
    await page.getByRole('menuitemcheckbox', { name: year, exact: true }).click()

    // Once the menu's button reads the year picked
    await expect(yearMenu).toHaveText(year)
  }

  // The id of the tab whose panel holds the target
  const tabId = await target
    .first()
    .locator('xpath=ancestor::*[@role="tabpanel"][1]')
    .getAttribute('aria-labelledby')

  // The round's tab, picked
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

  // The years the menu lists
  const items = page.getByRole('menuitemcheckbox')

  // Once the menu has drawn its years
  await expect(items.first()).toBeVisible()

  // Every year's name
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
  // The transcript, by its role and its label
  return page.getByRole('log', { name: chatCopy.transcriptLabel })
}

/**
 * Opens the chat on a problem's most recent conversation.
 *
 * @param within - The page the chat is opened on, or the one problem on it whose conversation to open.
 */
export async function openExistingDefense(within: Page | Locator): Promise<void> {
  // The first conversation row, a problem's newest, pressed
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

  // Once no dialog is left on the page
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/**
 * How far ahead of the page's own clock a pause is set, so the instant it names is still ahead when the pause
 * arrives: one already gone by is refused outright.
 */
const PAUSE_CUSHION_MS = 500

/**
 * Pauses the page's clock a moment ahead of where it stands, so anything timed on it from then on waits until the
 * spec walks it forward.
 *
 * @param page - The page whose clock to hold.
 */
export async function holdClock(page: Page): Promise<void> {
  // Where the page's own clock currently is
  const at = await page.evaluate(() => Date.now())

  // Held a cushion ahead of the page's clock
  await page.clock.pauseAt(at + PAUSE_CUSHION_MS)
}

/**
 * Writes one turn and sends it.
 *
 * @param page - The page the chat is open on.
 * @param text - What the turn says.
 */
export async function sendTurn(page: Page, text: string): Promise<void> {
  // The turn, written into the composer, the one text box on the page while the chat is open
  await page.locator('textarea').fill(text)

  // The keyboard path, which is how a student sends a turn without reaching for the mouse
  await page.keyboard.press('Meta+Enter')
}
