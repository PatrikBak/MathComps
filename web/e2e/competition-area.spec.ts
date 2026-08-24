import { expect, test } from '@playwright/test'

import {
  areaCopy,
  areaPath,
  chatCopy,
  COMPETITION_ID,
  holdClock,
  listPath,
  openExistingDefense,
  PROBLEM_COUNT,
  sendTurn,
} from './support/competitions'

/** How long the mocked backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition nobody in these scenarios has an entry on, so the guard has something to turn away. */
const UNENTERED_COMPETITION_ID = 'open-advanced'

test.describe('the competition area', () => {
  test('carries the scenario in with it', async ({ page }) => {
    // The list, read under a scenario every mocked answer is keyed on
    await page.goto(listPath('running'))

    // The way back into a clock still running
    await page.getByRole('link', { name: areaCopy.continue }).first().click()

    // Which carries the scenario in with it, or the area answers as a student who never entered
    await expect(page).toHaveURL(/\/competitions\/[^?]+\?scenario=running/)
  })

  test('puts the whole set on one page', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // Every statement at once, the entry's first minutes being spent deciding where the clock is worth
    // going
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('takes a turn and answers it', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // And the conversation it has already seeded on the first problem
    await openExistingDefense(page)

    // A conversation opened on a saved defense writes nothing until its resume settles, so the composer
    // going live is also the transcript being all there. Counted any earlier, the baseline is short by
    // whatever had not rendered yet
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // How many times the examiner has spoken so far, which one more turn has to move
    const transcript = page.getByLabel(chatCopy.transcriptLabel)
    const examinerTurnsBefore = await transcript.getByText('Mathilda', { exact: true }).count()

    // What the student says
    const turn =
      'Suppose the bound fails. Then there is a square strictly between two consecutive ones.'

    // Written and sent
    await sendTurn(page, turn)

    // The turn lands in the transcript, and the composer empties behind it
    await expect(transcript.getByText(turn)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
    await expect(page.locator('textarea')).toHaveValue('')

    // And the examiner answers it, which is what the student is actually waiting on
    await expect(transcript.getByText('Mathilda', { exact: true })).toHaveCount(
      examinerTurnsBefore + 1,
      { timeout: SETTLE_TIMEOUT_MS }
    )
  })

  test('keeps a half-written turn through a reload', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // And a conversation to write into
    await openExistingDefense(page)

    // Half a solution, never sent
    const draft = 'Half-written thought I do not want to lose'
    await page.locator('textarea').fill(draft)

    // A stray reload, which rebuilds the mocked transcript from its seed
    await page.reload()

    // Back into the same conversation
    await openExistingDefense(page)

    // Where the draft is still waiting, an entry being irreversible and its clock still running
    await expect(page.locator('textarea')).toHaveValue(draft, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('draws the line where the clock ran out and keeps writing under it', async ({ page }) => {
    // An entry whose clock has already run out
    await page.goto(areaPath('finished'))

    // And the conversation seeded across the boundary
    await openExistingDefense(page)

    // That the clock is spent, said where the next turn is about to be written
    await expect(page.getByText(chatCopy.competitionClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The line a grader reads by, drawn across the transcript itself
    await expect(
      page.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible()

    // The composer is still live: the entry stops counting, the conversation does not stop
    await expect(page.locator('textarea')).toBeEditable()

    // Out of the chat, to the page behind it
    await page.keyboard.press('Escape')

    // Which blames the clock, this entry having run its full length
    await expect(page.getByText(areaCopy.areaClockSpent)).toBeVisible()

    // And never calls it a hand-in
    await expect(page.getByText(areaCopy.areaFinished)).toHaveCount(0)
  })

  test('draws the line the moment the clock runs out under a reader watching it', async ({
    page,
  }) => {
    // A clock the spec can walk forward, the seeded case above starting already over
    await page.clock.install()

    // An entry with ninety seconds left on it
    await page.goto(areaPath('expiring'))

    // And a conversation open across the instant it runs out
    await openExistingDefense(page)

    // Before the buzzer: the seeded conversation is covered end to end, so nothing is said and nothing drawn
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })
    await expect(page.getByText(chatCopy.competitionClockSpent)).toHaveCount(0)
    await expect(
      page.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toHaveCount(0)

    // Past the ninety seconds this scenario leaves on the clock
    await page.clock.fastForward('02:00')

    // Which the reader is told about where they are about to write, without anybody reloading
    await expect(page.getByText(chatCopy.competitionClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A turn taken now
    await sendTurn(page, 'A turn taken after it stopped counting.')

    // The mocked reply is a timer like any other, so the fake clock has to be walked forward for it to land
    await page.clock.fastForward('00:05')

    // And it falls the other side of the line
    await expect(
      page.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('counts a turn sent before the buzzer, however long the reply takes', async ({ page }) => {
    // A clock the spec can hold still, the race being what happens between a turn being sent and its reply
    // coming back
    await page.clock.install()

    // An entry with a minute and a half left on it
    await page.goto(areaPath('expiring'))

    // And a conversation to write into
    await openExistingDefense(page)

    // Which is all there once the composer goes live
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // Time stops with the entry still running, so nothing lands until the spec lets it
    await holdClock(page)

    // What the student gets in with time to spare
    const turn = 'Sent with the clock still running, however long the answer takes.'

    // Written and sent
    await sendTurn(page, turn)

    // And the buzzer going while the examiner is still writing
    await page.clock.fastForward('05:00')

    // The conversation as it now reads
    const transcript = page.getByLabel(chatCopy.transcriptLabel)

    // The line is drawn, the reply having been said the other side of it
    await expect(
      transcript.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // With the student's own turn above it: a turn counts by when it reached the backend, never by when
    // the answer to it was ready
    await expect(
      transcript.locator('[role="separator"] ~ *').filter({ hasText: turn })
    ).toHaveCount(0)
  })

  test('counts a conversation opened before the buzzer from its greeting down', async ({
    page,
  }) => {
    // A clock the spec can hold still, the window being the one the greeting is minted in
    await page.clock.install()

    // An entry with a minute and a half left on it
    await page.goto(areaPath('expiring'))

    // Once the set is there to pick a problem from
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A problem nothing has been said about yet, so the conversation is minted by this turn
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // And a composer to write it in
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // Time stops with the entry still running
    await holdClock(page)

    // The turn that opens the conversation
    await sendTurn(page, 'The first thing I have to say about this one.')

    // And the buzzer going while the examiner is still writing
    await page.clock.fastForward('05:00')

    // The conversation as it now reads
    const transcript = page.getByLabel(chatCopy.transcriptLabel)

    // The line is drawn, the reply having been said the other side of it
    await expect(
      transcript.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // With that reply alone below it: the greeting belongs to the moment the conversation was asked for,
    // so it cannot be stamped after the turn that asked for it
    await expect(transcript.locator('[role="separator"] ~ *')).toHaveCount(1)
  })

  test('starts a practice retake with nothing the last run left behind', async ({ page }) => {
    // A clock the spec can walk past the practice run's own minute with
    await page.clock.install()

    // The list, where the practice run is taken
    await page.goto(listPath('ready'))

    // The press that takes it
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // Which the dialog confirms
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

    // Which lands in the transcript, so the run has something to leave behind
    await expect(page.getByLabel(chatCopy.transcriptLabel).getByText(said)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And half of what they were going to say next, never sent
    await page.locator('textarea').fill('Half a thought from the first run')

    // Left where it is, the chat closing over it
    await page.keyboard.press('Escape')

    // The practice minute, walked past, which is what leaves the run behind
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

    // Which lists nothing the last one said, every problem back to offering a first conversation
    await expect(page.getByRole('button', { name: /messages$/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: areaCopy.startDefense })).toHaveCount(
      PROBLEM_COUNT
    )

    // Time stops before the chat is opened, so what it draws is what this run already holds. A read
    // landing behind it corrects the list a beat later, which the assertion below would otherwise pass on
    await holdClock(page)

    // The chat, opened on a conversation this run has yet to hold
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // Nothing to browse back to: the control is offered only where a conversation was held, and none was
    await expect(page.getByRole('button', { name: chatCopy.history })).toHaveCount(0)

    // And once the chat has everything it is waiting on, an empty composer: a half-written turn is no more
    // part of this run than a sent one
    await page.clock.fastForward('00:05')
    await expect(page.locator('textarea')).toHaveValue('', { timeout: SETTLE_TIMEOUT_MS })
  })

  test('introduces the practice run once and then stops', async ({ page }) => {
    // The list, no scenario handing anybody a practice entry
    await page.goto(listPath('ready'))

    // So the way into the practice run is the press
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // Which the dialog confirms
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // What the practice run says about itself
    const intro = page.getByText(areaCopy.practiceIntro)

    // Said on arrival
    await expect(intro).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Until the reader says they have read it
    await page.getByRole('button', { name: areaCopy.practiceIntroDismiss }).click()

    // After which it is gone
    await expect(intro).toHaveCount(0)

    // A reload, which a component-local state would not survive
    await page.reload()

    // And once the area is back
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // It is still gone
    await expect(intro).toHaveCount(0)
  })

  test('reaches the rules without leaving the clock', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // The rules, agreed to once at the first entry ever and read here afterwards
    await page.getByRole('button', { name: areaCopy.rulesButton }).click()

    // Which open over the clock rather than away from it
    await expect(page.getByRole('dialog')).toContainText(areaCopy.rules.lines[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('offers nothing that could take a turn back', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // And a conversation to look for the controls in
    await openExistingDefense(page)

    // Browsing the conversations survives
    await expect(page.getByRole('button', { name: chatCopy.history })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // But nothing that could rewrite the record a grader reads
    await expect(page.getByRole('button', { name: chatCopy.rewind })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.report })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.deleteSession })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.newDefense })).toHaveCount(0)
  })

  test('lets an entry given up for the problems argue them anyway', async ({ page }) => {
    // An entry given up for the problems
    await page.goto(areaPath('forfeited'))

    // Which reads the same set as any other
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Said in plain sight, so the offer never reads as an entry that is somehow still live
    await expect(page.getByText(areaCopy.areaForfeited)).toBeVisible()

    // And the examiner argues them anyway, what the press spent being the result
    await expect(page.getByRole('button', { name: areaCopy.startDefense })).toHaveCount(
      PROBLEM_COUNT
    )
  })

  test('hands the entry in early and stops counting there', async ({ page }) => {
    // A clock still running, and a student who is done before it is
    await page.goto(areaPath('running'))

    // Handing the entry in
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // Out to the list, the way entering came in from it
    await expect(page).toHaveURL(/\/competitions\?scenario=running$/, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Where the row now offers the work back rather than a clock to go on spending
    const own = page.locator(`a[href="/en/competitions/${COMPETITION_ID}?scenario=running"]`)
    await expect(own).toHaveText(areaCopy.mySolutions, { timeout: SETTLE_TIMEOUT_MS })

    // Back inside
    await own.click()

    // Where the page says the student closed it themselves rather than that time ran out
    await expect(page.getByText(areaCopy.areaFinished)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And there is nothing left to hand in
    await expect(page.getByRole('button', { name: areaCopy.finishEntry })).toHaveCount(0)
  })

  test('takes the hand-in question away when the buzzer beats the student to it', async ({
    page,
  }) => {
    // A clock the spec can walk forward
    await page.clock.install()

    // And an entry with ninety seconds left to walk past
    await page.goto(areaPath('expiring'))

    // The question, asked while there is still an entry to answer it about
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which says what the press costs
    await expect(page.getByText(areaCopy.finishDialog.consequence)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the clock running out underneath it
    await page.clock.fastForward('02:00')

    // The page says so
    await expect(page.getByText(areaCopy.areaClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the question goes with the entry it was about, rather than leaving a press which cannot be
    // undone standing over a page that has moved on without it
    await expect(page.getByText(areaCopy.finishDialog.consequence)).toHaveCount(0)
  })

  test('keeps an entry taken a moment ago through a reload', async ({ page }) => {
    // The list, where an entry is taken
    await page.goto(listPath('ready'))

    // The press that takes one
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // Which the dialog confirms
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // The press lands them inside, since the list has no way to show what an entry is spent on
    await expect(page).toHaveURL(/\/competitions\/[^?]+\?scenario=ready/, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A reload, which the mocked backend holds its facts in memory across
    await page.reload()

    // Still inside, rather than turned away as somebody who never entered
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('turns away a reader with no entry without losing their scenario', async ({ page }) => {
    // The area of a competition nobody in this scenario entered, whose problems are embargoed
    await page.goto(areaPath('running', UNENTERED_COMPETITION_ID))

    // Which sends the reader to the list, with the scenario still on the address
    await expect(page).toHaveURL(/\/competitions\?scenario=running/, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('keeps the competition it is on when the reader changes language', async ({ page }) => {
    // The area of a competition the student is inside
    await page.goto(areaPath('running'))

    // Once it is there to switch away from
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The language switcher
    await page.getByRole('button', { name: /Change language/i }).click()

    // Taken to Slovak
    await page.getByRole('menuitem', { name: /Sloven/i }).click()

    // Which re-expresses the route and keeps the competition its dynamic segment names
    await expect(page).toHaveURL(new RegExp(`/sk/sutaze/${COMPETITION_ID}`), {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })
})
