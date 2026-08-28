import type { Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import messages from '../../messages/en.json'

/**
 * The copy the assertions match on, taken from the app's own English messages: what each of them means is
 * that a particular message is on screen, not that a particular sentence is.
 */
const { competitions: competitionsCopy, defense: defenseCopy, ui } = messages

/** The copy the competitions surface reads under. */
export const areaCopy = competitionsCopy

/** The copy the defense chat reads under. */
export const chatCopy = defenseCopy

/** The labels every shared control reads under, whichever surface it is on. */
export const actionsCopy = ui.actions

/**
 * The competitions list in English, which is the canonical locale and so carries no route translation.
 */
export const LIST_PATH = `/en${ROUTES.COMPETITIONS}`

/**
 * One competition's own area.
 *
 * @param competitionId - Which competition's area.
 *
 * @returns The path.
 */
export function areaPath(competitionId: string): string {
  // An area hangs off the list under the competition's own id
  return `${LIST_PATH}/${competitionId}`
}

/**
 * Opens the chat on a problem's most recent conversation.
 *
 * @param page - The page it is being opened on.
 */
export async function openExistingDefense(page: Page): Promise<void> {
  // The row carries how many turns have gone into the conversation, which is what names it
  await page
    .getByRole('button', { name: /messages$/ })
    .first()
    .click()
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
