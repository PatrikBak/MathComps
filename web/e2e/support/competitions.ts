import type { Page } from '@playwright/test'

import messages from '../../messages/en.json'

/**
 * The copy the assertions match on, taken from the app's own English messages: what each of them means is
 * that a particular message is on screen, not that a particular sentence is.
 */
const { competitions: competitionsCopy, defense: defenseCopy } = messages

/** The copy the competitions surface reads under. */
export const areaCopy = competitionsCopy

/** The copy the defense chat reads under. */
export const chatCopy = defenseCopy

/** The competition the specs enter, one of the open group's three. */
export const COMPETITION_ID = 'open-intermediate'

/** How many problems its set holds. */
export const PROBLEM_COUNT = 3

/**
 * The list, read under one of the mocked backend's scenarios.
 *
 * @param scenario - Which set of facts to read it under.
 *
 * @returns The path.
 */
export function listPath(scenario: string): string {
  // The list, with the scenario the mocked backend answers from
  return `/en/competitions?scenario=${scenario}`
}

/**
 * One competition's own area, read under one of the mocked backend's scenarios.
 *
 * @param scenario - Which set of facts to read it under.
 * @param competitionId - Which competition's area.
 *
 * @returns The path.
 */
export function areaPath(scenario: string, competitionId: string = COMPETITION_ID): string {
  // The area, with the scenario the mocked backend answers from
  return `/en/competitions/${competitionId}?scenario=${scenario}`
}

/**
 * The scenario naming a reader with no account at all, which no query value spells on its own.
 */
export const SIGNED_OUT_SCENARIO = 'signed-out'

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
