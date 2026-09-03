import { BACKEND_ORIGIN } from './support/backend-routes'
import {
  actionsCopy,
  areaCopy,
  areaPath,
  chatCopy,
  holdClock,
  LIST_PATH,
  openExistingDefense,
  sendTurn,
  transcriptOf,
} from './support/competitions'
import {
  COMPETITION_SLUG,
  installHostedBackend,
  LIMITS,
  OPENER,
  PROBLEM_COUNT,
} from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

test.describe('the conversation inside a competition', () => {
  test('takes a turn and answers it', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // And the conversation already seeded on the first problem
    await openExistingDefense(page)

    // A conversation opened on a saved defense writes nothing until its resume settles, so the
    // composer going live is also the transcript being all there. Counted any earlier, the baseline
    // is short by whatever had not rendered yet
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // The transcript as it now reads
    const transcript = transcriptOf(page)

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
    await page.goto(areaPath(COMPETITION_SLUG))

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

  test('says it could not read the acknowledgement rather than asking a reader who gave it', async ({
    page,
  }) => {
    // A student who acknowledged it long ago
    await installHostedBackend(page, 'running')

    // Whether the read of that gets through
    let isConsentReachable = false

    // Registered after the backend standing in behind it, which is what puts this one first
    await page.route(`${BACKEND_ORIGIN}/users/me/ai-consent`, async (route) => {
      // Anything the outage is not about goes on to the backend behind this
      if (isConsentReachable || route.request().method() !== 'GET') {
        await route.fallback()
        return
      }

      // An aborted connection is what a student sees when nothing is there to answer them
      await route.abort('connectionrefused')
    })

    // Open the competition's area
    await page.goto(areaPath(COMPETITION_SLUG))

    // And the conversation the entry already holds
    await openExistingDefense(page)

    // The chat says what it could not find out
    await expect(page.getByText(chatCopy.consentUnavailable)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Rather than asking again for something they already gave
    await expect(page.getByText(chatCopy.consentBody)).toHaveCount(0)

    // With nowhere to write in the meantime
    await expect(page.locator('textarea')).toHaveCount(0)

    // Something to answer the next read
    isConsentReachable = true

    // Asked once more
    await page.getByRole('button', { name: actionsCopy.retry }).click()

    // After which the chat is theirs again
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })

    // And the apology is gone
    await expect(page.getByText(chatCopy.consentUnavailable)).toHaveCount(0)
  })

  test('says it could not read the conversation rather than leaving the student waiting', async ({
    page,
  }) => {
    // A student inside a competition, with a conversation already saved on its first problem
    await installHostedBackend(page, 'running')

    // Whether the read carrying that conversation gets through
    let isHistoryReachable = false

    // Registered after the backend standing in behind it, which is what puts this one first
    await page.route(`${BACKEND_ORIGIN}/defense/sessions/problems/*`, async (route) => {
      // Anything the outage is not about goes on to the backend behind this
      if (isHistoryReachable) {
        await route.fallback()
        return
      }

      // An aborted connection is what a student sees when nothing is there to answer them
      await route.abort('connectionrefused')
    })

    // Open the competition's area
    await page.goto(areaPath(COMPETITION_SLUG))

    // And the conversation the entry already holds
    await openExistingDefense(page)

    // The chat says what it could not read
    await expect(page.getByText(chatCopy.conversationUnavailable)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Rather than a wait on a read that has already given up
    await expect(page.getByText(chatCopy.libraryLoading)).toHaveCount(0)

    // With nowhere to write in the meantime
    await expect(page.locator('textarea')).toHaveCount(0)

    // Something to answer the next read
    isHistoryReachable = true

    // Asked once more
    await page.getByRole('button', { name: actionsCopy.retry }).click()

    // After which the conversation they asked for opens on what was already argued in it
    await expect(page.getByText('I claim the only solutions are')).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And it is theirs to carry on with
    await expect(page.locator('textarea')).toBeEditable({ timeout: SETTLE_TIMEOUT_MS })
  })

  test('keeps a half-written turn through a reload', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await page.goto(areaPath(COMPETITION_SLUG))

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
    const transcript = transcriptOf(page)

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
    await page.goto(areaPath(COMPETITION_SLUG))

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

    // What the turn opening the conversation says
    const opening = 'The first thing I have to say about this one.'

    // Written and sent
    await sendTurn(page, opening)

    // The conversation as it now reads
    const transcript = transcriptOf(page)

    // Held until the turn is in it: a clock walked forward before the mint lands stamps the greeting and
    // this turn after the buzzer too, and the line is then drawn above all three
    await expect(transcript.getByText(opening)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And the buzzer going while the examiner is still writing
    await page.clock.fastForward('05:00')

    // The line is drawn, the reply having been said the other side of it
    await expect(
      transcript.getByRole('separator', { name: chatCopy.competitionClockDivider })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // With that reply alone below it: the greeting belongs to the moment the conversation was asked
    // for, so it cannot be stamped after the turn that asked for it
    await expect(transcript.locator('[role="separator"] ~ *')).toHaveCount(1)

    // And greeted once across the save: the chat greets an unsaved conversation itself, the saved one
    // that lands here carries a greeting of its own, and only one of the two may be on screen
    await expect(transcript.getByText(OPENER)).toHaveCount(1)
  })

  test('offers nothing that could take a turn back, and everything that only says something', async ({
    page,
  }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await expect(page.getByText(chatCopy.reportGradedNote)).toBeVisible()

    // Away again, leaving the conversation as it was
    await page.getByRole('button', { name: actionsCopy.cancel }).click()

    // But nothing that could rewrite the record the conversation leaves behind. Starting another one is
    // still offered: it adds to that record rather than taking anything out of it
    await expect(page.getByRole('button', { name: chatCopy.rewind })).toHaveCount(0)
    await expect(page.getByRole('button', { name: chatCopy.deleteSession })).toHaveCount(0)
  })

  test('lets a student take back a practice conversation, which grades nobody', async ({
    page,
  }) => {
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

    // What the student argues, which is what the conversation is saved under
    const said = 'The bound follows from the pigeonhole on the residues'
    await sendTurn(page, said)

    // Answered, which is the conversation the backend now holds
    const transcript = transcriptOf(page)
    await expect(transcript.getByText(said)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Saying what went wrong with a reply is offered here too
    await page.getByRole('button', { name: chatCopy.report }).first().click()

    // But it promises no grader, there being none to promise
    await expect(page.getByText(chatCopy.reportGradedNote)).toHaveCount(0)

    // Away again, leaving the conversation as it was
    await page.getByRole('button', { name: actionsCopy.cancel }).click()

    // Take the turn back, to the greeting the conversation opened on
    await page.getByRole('button', { name: chatCopy.rewind }).first().click()

    // Which the dialog confirms
    await page.getByRole('button', { name: actionsCopy.confirm }).click()

    // Leaving nothing the student said behind: a practice run grades nobody, so there is no record to keep
    await expect(transcript.getByText(said)).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS })

    // The list of this problem's conversations
    await page.getByRole('button', { name: chatCopy.history }).click()

    // Where the conversation itself goes the same way
    await page.getByRole('button', { name: chatCopy.deleteSession }).first().click()

    // Confirmed, since a drop is not taken back
    await page.getByRole('button', { name: actionsCopy.confirm }).click()

    // Which leaves the problem with none, the way it stood before any of this was argued
    await expect(page.getByRole('button', { name: chatCopy.history })).toHaveCount(0, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('counts the conversation down from its first message inside a competition', async ({
    page,
  }) => {
    // A student forty minutes into a two-hour clock
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // And start a conversation about the first problem
    await page.getByRole('button', { name: areaCopy.startDefense }).first().click()

    // The room the conversation has, said before a word of it is spent: a clock pushes a student to spend
    // messages fast, and nothing undoes a conversation spent that way
    await expect(page.getByText(`0/${LIMITS.maxMessagesPerDefense}`, { exact: true })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // One message spent
    await sendTurn(page, 'The bound follows from the pigeonhole on the residues')

    // And the count moves with it
    await expect(page.getByText(`1/${LIMITS.maxMessagesPerDefense}`, { exact: true })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })
})
