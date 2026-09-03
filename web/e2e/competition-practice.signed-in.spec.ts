import { areaCopy, LIST_PATH, sendTurn, transcriptOf } from './support/competitions'
import { installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

test.describe('the practice run', () => {
  test("carries a practice run's conversations into the retake, on a fresh clock", async ({
    page,
  }) => {
    // A clock the spec can walk past the practice run's own minute with
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list, where the practice run is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Inside, on a set nobody has argued yet
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A conversation held about the first problem
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // And a composer to write it in
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // What the student says in this run
    const said = 'What I argued the first time round.'

    // Written and sent
    await sendTurn(page, said)

    // The turn lands in the transcript, so the run has something to leave behind
    await expect(transcriptOf(page).getByText(said)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Out of the chat, to the page behind it
    await page.keyboard.press('Escape')

    // The practice minute, walked past, which is what ends the run
    await page.clock.fastForward('02:00')

    // Out to the list the way the app goes there, which keeps what the last run left in the cache
    await page.getByRole('link', { name: areaCopy.backToCompetitions }).click()

    // Where the practice run is the one competition offering a second go
    await page
      .getByRole('button', { name: areaCopy.tryAgain })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Which the dialog confirms
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Inside a fresh run of the same set
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Still carrying what the last run said: a conversation hangs off the problem, not off the
    // entry, so retaking resets the clock and takes nothing else back
    await expect(page.locator('[data-defense-session-id]')).toHaveCount(1)

    // And the clock is the run's own, not what was left of the last one
    await expect(page.getByText(areaCopy.clockSpent)).toHaveCount(0)
  })

  test('clears the practice tips for the view and says them again on a fresh read', async ({
    page,
  }) => {
    // A student holding no practice entry yet
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // What the practice run says about the conversations it holds
    const tips = page.getByText(areaCopy.practiceConversations)

    // Which is said on arrival
    await expect(tips).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Clear them off the page, the reader having read them
    await page.getByRole('button', { name: areaCopy.practiceConversationsDismiss }).click()

    // After which they are gone
    await expect(tips).toHaveCount(0)

    // A reload, which is a fresh read of the run
    await page.reload()

    // And once the area is back
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The tips are there again, the dismissal having lasted only for that view
    await expect(tips).toBeVisible()
  })

  test('says nothing about a result when a practice clock runs out', async ({ page }) => {
    // A clock the spec can walk past the practice run's own minute with
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list, where the practice run is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Inside, on the set the run is spent on
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The practice minute, walked past, which is what ends the run
    await page.clock.fastForward('02:00')

    // After which the page says nothing at all: both halves of the graded sentence are about a result
    // the practice run does not have
    await expect(page.getByText(areaCopy.areaClockSpent)).toHaveCount(0)
    await expect(page.getByText(areaCopy.areaFinished)).toHaveCount(0)
  })

  test('says nothing about a result when a practice run is handed in', async ({ page }) => {
    // A clock held where it is, so the practice minute cannot run out under a hand-in meant to beat it
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list, where the practice run is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Inside, on the set the run is spent on
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Hand it in ahead of its own clock
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // Nothing left to hand in, so the page has settled
    await expect(page.getByRole('button', { name: areaCopy.finishEntry })).toHaveCount(0, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the set stays where it is
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT)

    // Where it promises nothing about a result, because it has none to promise
    await expect(page.getByText(areaCopy.areaFinished)).toHaveCount(0)
    await expect(page.getByText(areaCopy.areaClockSpent)).toHaveCount(0)
  })
})
