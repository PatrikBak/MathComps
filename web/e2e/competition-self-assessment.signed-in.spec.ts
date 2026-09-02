import { actionsCopy, areaCopy, areaPath, LIST_PATH } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** What a student writes about one of their own solutions, distinctive enough to find again. */
const NOTE = 'I think the last case holds, I just could not write it up in time'

/** What they write instead, on a second thought a refused write has to leave unsaid. */
const REVISED_NOTE = 'On reflection the last case needs the bound the other way round'

test.describe('the notes a student leaves', () => {
  test('takes notes again on a practice run the student retakes', async ({ page }) => {
    // A clock the spec can walk past the practice run's minute and the grace after it with
    await page.clock.install()

    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list, where the practice run is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Inside, where the first problem is asked about
    await page
      .getByRole('button', { name: areaCopy.selfAssessmentAsk })
      .first()
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Which does not promise them a reader, the practice run being the one nobody grades
    await expect(page.getByText(areaCopy.selfAssessmentPracticeNote)).toBeVisible()

    // What the student says about it in this run
    await page.getByRole('textbox').fill(NOTE)

    // Written down
    await page.getByRole('button', { name: actionsCopy.save }).click()

    // Which the problem carries, and which they can still open
    await expect(page.getByRole('button', { name: NOTE })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The run's minute and the whole grace after it, walked past
    await page.clock.fastForward('40:00')

    // Leaving the words to re-read and nothing to press on them
    await expect(page.getByText(NOTE).first()).toBeVisible()
    await expect(page.getByRole('button', { name: NOTE })).toHaveCount(0)

    // Out to the list the way the app goes there
    await page.getByRole('link', { name: areaCopy.backToCompetitions }).click()

    // Where the practice run is the one competition offering a second go
    await page
      .getByRole('button', { name: areaCopy.tryAgain })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Which the dialog confirms
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Where what they said is still theirs, and open again: a retake is a fresh run, and a run is
    // what the window hangs off
    await expect(page.getByRole('button', { name: NOTE })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('keeps the note the student leaves about their own solution', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // The first problem's invitation to say something, which stands until something is said
    await page
      .getByRole('button', { name: areaCopy.selfAssessmentAsk })
      .first()
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // What the student writes about it
    await page.getByRole('textbox').fill(NOTE)

    // Written down
    await page.getByRole('button', { name: actionsCopy.save }).click()

    // Which the problem then carries in place of the invitation
    const left = page.getByRole('button', { name: NOTE })
    await expect(left).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And still carries once the page has read the set back rather than remembered it
    await page.reload()
    await expect(left).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('takes the note back off the problem', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // The first problem's invitation to say something
    await page
      .getByRole('button', { name: areaCopy.selfAssessmentAsk })
      .first()
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Something the student writes about it
    await page.getByRole('textbox').fill(NOTE)

    // Written down
    await page.getByRole('button', { name: actionsCopy.save }).click()

    // Which the problem then carries
    const left = page.getByRole('button', { name: NOTE })

    // Reopened on it
    await left.click({ timeout: SETTLE_TIMEOUT_MS })

    // And taken back
    await page.getByRole('button', { name: actionsCopy.remove }).click()

    // Leaving the problem asking again
    await expect(left).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })

    // And still asking once the set is read back from the server rather than off the press
    await page.reload()
    await expect(left).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('puts the note back when the server refuses to keep it', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // The first problem's invitation to say something
    await page
      .getByRole('button', { name: areaCopy.selfAssessmentAsk })
      .first()
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // Something the backend does take
    await page.getByRole('textbox').fill(NOTE)

    // Written down
    await page.getByRole('button', { name: actionsCopy.save }).click()

    // Which stands, and is what a refused revision has to leave behind
    const left = page.getByRole('button', { name: NOTE })
    await expect(left).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // A backend that now turns the write away, registered after the fake's own route so that this is the
    // one Playwright tries first
    await page.route('**/competitions/*/problems/*/assessment', (route) =>
      route.fulfill({ status: 500, body: '' })
    )

    // Reopened on what stands
    await left.click()

    // The revision it turns away
    await page.getByRole('textbox').fill(REVISED_NOTE)

    // Sent
    await page.getByRole('button', { name: actionsCopy.save }).click()

    // Leaving the problem saying what it said before rather than what nothing kept: the words go onto the
    // problem before the server has answered, so a refusal has to take them back off it
    await expect(page.getByRole('button', { name: REVISED_NOTE })).toHaveCount(0, {
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(left).toBeVisible()
  })

  test('stops taking notes once the entry is over', async ({ page }) => {
    // An entry closed an hour ago
    await installHostedBackend(page, 'finished')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which reads the same set as any other
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And offers nothing more to say about any of it, the transcript a grader reads having stopped there
    await expect(page.getByRole('button', { name: areaCopy.selfAssessmentAsk })).toHaveCount(0)
  })

  test('still reads back a note left before the entry closed', async ({ page }) => {
    // An entry closed an hour ago, with something the student wrote while it was still open
    await installHostedBackend(page, 'finished', { standingNote: NOTE })

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which still shows them what they said, with nothing left to click on it
    await expect(page.getByText(NOTE)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: NOTE })).toHaveCount(0)
  })
})
