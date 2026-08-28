import {
  actionsCopy,
  areaCopy,
  areaPath,
  chatCopy,
  holdClock,
  LIST_PATH,
  openExistingDefense,
  sendTurn,
} from './support/competitions'
import { COMPETITION_ID, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** What a student writes about one of their own solutions, distinctive enough to find again. */
const NOTE = 'I think the last case holds, I just could not write it up in time'

/** What they write instead, on a second thought a refused write has to leave unsaid. */
const REVISED_NOTE = 'On reflection the last case needs the bound the other way round'

/** A competition no state ever holds an entry on, so the guard has something to turn away. */
const UNENTERED_COMPETITION_ID = 'open-advanced'

test.describe('the competition area', () => {
  test('puts the whole set on one page', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // Which draws every statement at once
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('takes a turn and answers it', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And the conversation already seeded on the first problem
    await openExistingDefense(page)

    // A conversation opened on a saved defense writes nothing until its resume settles, so the
    // composer going live is also the transcript being all there. Counted any earlier, the baseline
    // is short by whatever had not rendered yet
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // The transcript as it now reads
    const transcript = page.getByLabel(chatCopy.transcriptLabel)

    // How many times the examiner has spoken so far, which one more turn has to move
    const examinerTurnsBefore = await transcript.getByText('Mathilda', { exact: true }).count()

    // What the student says
    const turn =
      'Suppose the bound fails. Then there is a square strictly between two consecutive ones.'

    // Written and sent
    await sendTurn(page, turn)

    // The turn lands in the transcript
    await expect(transcript.getByText(turn)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And the composer empties behind it
    await expect(page.locator('textarea')).toHaveValue('')

    // And the examiner answers it, which is what the student is actually waiting on
    await expect(transcript.getByText('Mathilda', { exact: true })).toHaveCount(
      examinerTurnsBefore + 1,
      { timeout: SETTLE_TIMEOUT_MS }
    )
  })

  test('asks a first-time reader to acknowledge Mathilda before writing anything', async ({
    page,
  }) => {
    // A student inside a competition who has never opened the chat before
    await installHostedBackend(page, 'running', { hasConsented: false })

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And the conversation the entry already holds
    await openExistingDefense(page)

    // The chat opens on what talking to her entails
    await expect(page.getByText(chatCopy.consentBody)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // With nowhere to write yet
    await expect(page.locator('textarea')).toHaveCount(0)

    // Acknowledge it, which is asked once and then never again
    await page.getByRole('button', { name: chatCopy.consentAccept }).click()

    // After which there is somewhere to write
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // And the acknowledgement is gone
    await expect(page.getByText(chatCopy.consentBody)).toHaveCount(0)
  })

  test('keeps a half-written turn through a reload', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And a conversation to write into
    await openExistingDefense(page)

    // Half a solution, never sent
    const draft = 'Half-written thought I do not want to lose'

    // Written into the composer
    await page.locator('textarea').fill(draft)

    // A stray reload, which rebuilds the transcript from what the fake holds
    await page.reload()

    // Back into the same conversation
    await openExistingDefense(page)

    // Where the draft is still waiting
    await expect(page.locator('textarea')).toHaveValue(draft, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('draws the line where the clock ran out and keeps writing under it', async ({ page }) => {
    // An entry whose clock has already run out
    await installHostedBackend(page, 'finished')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And the conversation seeded across the boundary
    await openExistingDefense(page)

    // That the clock is spent, said where the next turn is about to be written
    await expect(page.getByText(chatCopy.competitionClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The line the clock ran out on, drawn across the transcript itself
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
    // A clock the spec can walk forward, this entry starting with time still on it
    await page.clock.install()

    // An entry with ninety seconds left on it
    await installHostedBackend(page, 'expiring')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And a conversation open across the instant it runs out
    await openExistingDefense(page)

    // The seeded conversation is covered end to end once the composer goes live
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // So before the buzzer nothing is said about a spent clock
    await expect(page.getByText(chatCopy.competitionClockSpent)).toHaveCount(0)

    // And no line is drawn
    await expect(
      page.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toHaveCount(0)

    // Past the ninety seconds this state leaves on the clock
    await page.clock.fastForward('02:00')

    // The reader is told so where they are about to write, without anybody reloading
    await expect(page.getByText(chatCopy.competitionClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A turn taken now
    await sendTurn(page, 'A turn taken after it stopped counting.')

    // The reply is held until the page's own clock has moved on, so a held clock has to be walked
    // forward for it to land
    await page.clock.fastForward('00:05')

    // And the turn falls the other side of the line
    await expect(
      page.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('counts a turn sent before the buzzer, however long the reply takes', async ({ page }) => {
    // A clock the spec can hold still, the race being what happens between a turn being sent and
    // its reply coming back
    await page.clock.install()

    // An entry with a minute and a half left on it
    await installHostedBackend(page, 'expiring')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And a conversation to write into
    await openExistingDefense(page)

    // Which is all there once the composer goes live
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // Stop time with the entry still running, so nothing lands until the spec lets it
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

    // With the student's own turn above it: a turn counts by when it reached the backend, never by
    // when the answer to it was ready
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
    await installHostedBackend(page, 'expiring')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // Once the set is there to pick a problem from
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A problem nothing has been said about yet, so the conversation is minted by this turn
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // And a composer to write it in
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // Stop time with the entry still running
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

    // With that reply alone below it: the greeting belongs to the moment the conversation was asked
    // for, so it cannot be stamped after the turn that asked for it
    await expect(transcript.locator('[role="separator"] ~ *')).toHaveCount(1)
  })

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
    await expect(page.getByLabel(chatCopy.transcriptLabel).getByText(said)).toBeVisible({
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
    await expect(page.getByRole('button', { name: /messages$/ })).toHaveCount(1)

    // And the clock is the run's own, not what was left of the last one
    await expect(page.getByText(areaCopy.clockSpent)).toHaveCount(0)
  })

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

  test('introduces the practice run once and then stops', async ({ page }) => {
    // A student holding no practice entry yet
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // What the practice run says about itself
    const intro = page.getByText(areaCopy.practiceIntro)

    // Which is said on arrival
    await expect(intro).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Dismiss it, the reader having read it
    await page.getByRole('button', { name: areaCopy.practiceIntroDismiss }).click()

    // After which the intro is gone
    await expect(intro).toHaveCount(0)

    // A reload, which a component-local state would not survive
    await page.reload()

    // And once the area is back
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The intro is still gone
    await expect(intro).toHaveCount(0)
  })

  test('reaches the rules without leaving the clock', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // The rules, agreed to once at the first entry ever and read here afterwards
    await page.getByRole('button', { name: areaCopy.rulesButton }).click()

    // Which open in a dialog over the area, the clock never left
    await expect(page.getByRole('dialog')).toContainText(areaCopy.rules.lines[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('offers nothing that could take a turn back, and everything that only says something', async ({
    page,
  }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // And a conversation to look for the controls in
    await openExistingDefense(page)

    // Browsing the conversations survives
    await expect(page.getByRole('button', { name: chatCopy.history })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // So does saying what went wrong with a reply, which sits beside the record rather than rewriting it
    await page.getByRole('button', { name: chatCopy.report }).first().click()

    // And inside a competition it says who ends up reading that, since a student writing one means it as a
    // case for their solution rather than as a note about the examiner
    await expect(page.getByText(chatCopy.reportCompetitionNote)).toBeVisible()

    // Away again, leaving the conversation as it was
    await page.getByRole('button', { name: actionsCopy.cancel }).click()

    // But nothing that could rewrite the record the conversation leaves behind
    await expect(page.getByRole('button', { name: chatCopy.rewind })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.deleteSession })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.newDefense })).toHaveCount(0)
  })

  test('keeps the note the student leaves about their own solution', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

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
    await page.goto(areaPath(COMPETITION_ID))

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
    await page.goto(areaPath(COMPETITION_ID))

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
    await page.goto(areaPath(COMPETITION_ID))

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
    await page.goto(areaPath(COMPETITION_ID))

    // Which still shows them what they said, with nothing left to click on it
    await expect(page.getByText(NOTE)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
    await expect(page.getByRole('button', { name: NOTE })).toHaveCount(0)
  })

  test('lets an entry given up for the problems argue them anyway', async ({ page }) => {
    // An entry given up for the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // Which reads the same set as any other
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With the entry named as given up, in plain sight
    await expect(page.getByText(areaCopy.areaForfeited)).toBeVisible()

    // And every problem still offering the examiner
    await expect(page.getByRole('button', { name: areaCopy.startDefense })).toHaveCount(
      PROBLEM_COUNT
    )

    // But asking nothing about their solutions, an entry given up never having been a run
    await expect(page.getByRole('button', { name: areaCopy.selfAssessmentAsk })).toHaveCount(0)
  })

  test('hands the entry in early and stops counting there', async ({ page }) => {
    // A clock still running, and a student who is done before it is
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // Hand the entry in
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // Out to the list, the way entering came in from it
    await expect(page).toHaveURL(/\/competitions$/, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The row of the competition just handed in
    const own = page.locator(`a[href="/en/competitions/${COMPETITION_ID}"]`)

    // Which now offers the work back
    await expect(own).toHaveText(areaCopy.mySolutions, { timeout: SETTLE_TIMEOUT_MS })

    // Back inside
    await own.click()

    // Where the page names it a hand-in, not a spent clock
    await expect(page.getByText(areaCopy.areaFinished)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And there is nothing left to hand in
    await expect(page.getByRole('button', { name: areaCopy.finishEntry })).toHaveCount(0)
  })

  test('offers a re-entrant competition again once it has been handed in', async ({ page }) => {
    // A student with nothing taken yet
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // The press that would take the practice run a second time
    const again = page.getByRole('button', { name: areaCopy.tryAgain })

    // Which the list offers as a first go
    await expect(page.getByRole('button', { name: areaCopy.try })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And not yet as a second one
    await expect(again).toHaveCount(0)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Once the student is inside it
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Hand it in ahead of its own clock
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // Out to the list, where the practice run is the one competition offering another go
    await expect(again).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('takes the hand-in question away when the buzzer beats the student to it', async ({
    page,
  }) => {
    // A clock the spec can walk forward
    await page.clock.install()

    // And an entry with ninety seconds left to walk past
    await installHostedBackend(page, 'expiring')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // The question, asked while there is still an entry to answer it about
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which says what the press costs
    await expect(page.getByText(areaCopy.finishDialog.consequence)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the clock running out underneath it
    await page.clock.fastForward('02:00')

    // The page says the clock is spent
    await expect(page.getByText(areaCopy.areaClockSpent)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And the question goes with the entry it was about
    await expect(page.getByText(areaCopy.finishDialog.consequence)).toHaveCount(0)
  })

  test('keeps an entry taken a moment ago through a reload', async ({ page }) => {
    // A student with an entry still to spend
    await installHostedBackend(page, 'ready')

    // Open the list, where the entry is taken
    await page.goto(LIST_PATH)

    // Press try
    await page.getByRole('button', { name: areaCopy.try }).first().click()

    // And confirm the dialog
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // The press lands them inside, since the list has no way to show what an entry is spent on
    await expect(page).toHaveURL(/\/competitions\/[^?]+$/, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A reload, which the fake backend holds its facts in memory across
    await page.reload()

    // Still inside, rather than turned away as somebody who never entered
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('turns away a reader with no entry', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open the area of a competition they never entered
    await page.goto(areaPath(UNENTERED_COMPETITION_ID))

    // Which sends them back to the list rather than serving them the statements
    await expect(page).toHaveURL(/\/competitions$/, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('keeps the competition it is on when the reader changes language', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_ID))

    // Once the area is there to switch away from
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
