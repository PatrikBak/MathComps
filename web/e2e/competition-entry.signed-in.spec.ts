import { BACKEND_ORIGIN } from './support/backend-routes'
import { areaCopy, areaPath, LIST_PATH } from './support/competitions'
import { COMPETITION_SLUG, installHostedBackend, PROBLEM_COUNT } from './support/hosted-backend'
import { expect, test } from './support/test'

/** How long the fake backend has to answer before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A competition no state ever holds an entry on, so the guard has something to turn away. */
const UNENTERED_COMPETITION_SLUG = 'open-advanced'

/** A competition of the group that has not opened yet, which nobody ordinary can enter or read. */
const UPCOMING_COMPETITION_SLUG = 'upcoming-intermediate'

/** A competition of the group that has not opened yet, announced before anybody picked its problems. */
const UNFILLED_COMPETITION_SLUG = 'upcoming-advanced'

test.describe('the entry and the area it opens', () => {
  test('puts the whole set on one page', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which draws every statement at once
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('reaches the rules without leaving the clock', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // The rules, agreed to once at the first entry ever and read here afterwards
    await page.getByRole('button', { name: areaCopy.rulesButton }).click()

    // Which open in a dialog over the area, the clock never left
    await expect(page.getByRole('dialog')).toContainText(areaCopy.rules.lines[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('lets an entry given up for the problems argue them anyway', async ({ page }) => {
    // An entry given up for the problems
    await installHostedBackend(page, 'forfeited')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await page.goto(areaPath(COMPETITION_SLUG))

    // Hand the entry in
    await page.getByRole('button', { name: areaCopy.finishEntry }).click()

    // Which is asked about before it happens
    await page.getByRole('button', { name: areaCopy.finishDialog.confirm, exact: true }).click()

    // The page stays on the set, naming it a hand-in rather than a spent clock
    await expect(page.getByText(areaCopy.areaFinished)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And there is nothing left to hand in
    await expect(page.getByRole('button', { name: areaCopy.finishEntry })).toHaveCount(0)

    // Out on the list
    await page.goto(LIST_PATH)

    // Where the row of the competition just handed in now offers the work back
    await expect(page.locator(`a[href="/en/mathilding/${COMPETITION_SLUG}"]`)).toHaveText(
      areaCopy.mySolutions,
      { timeout: SETTLE_TIMEOUT_MS }
    )
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

    // And back out on the list
    await page.goto(LIST_PATH)

    // Where the practice run is the one competition offering another go
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
    await page.goto(areaPath(COMPETITION_SLUG))

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
    await expect(page).toHaveURL(/\/mathilding\/[^?]+$/, {
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
    await page.goto(areaPath(UNENTERED_COMPETITION_SLUG))

    // Which sends them back to the list rather than serving them the statements
    await expect(page).toHaveURL(/\/mathilding$/, { timeout: SETTLE_TIMEOUT_MS })

    // Told the competition is one they have yet to start, which is an offer rather than a refusal
    await expect(page.getByText(areaCopy.areaNotStarted)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('blames the read rather than the entry when the surface stops answering', async ({
    page,
  }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Whose surface then stops answering, which is the read the entry itself is found in
    await page.route(`${BACKEND_ORIGIN}/competitions`, (route) => route.abort('connectionrefused'))

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which says the read failed
    await expect(page.getByText(areaCopy.loadFailed)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And leaves them on it: a page that could not read the entry is not one that found none
    await expect(page).toHaveURL(new RegExp(`/mathilding/${COMPETITION_SLUG}$`))
  })

  test('blames the problems read rather than the whole page when only it fails', async ({
    page,
  }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Whose problems stop coming, the entry behind them still reading fine
    await page.route(`${BACKEND_ORIGIN}/competitions/*/problems`, (route) =>
      route.abort('connectionrefused')
    )

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Which says what actually failed
    await expect(page.getByText(areaCopy.areaProblemsFailed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And not what the surface says when nothing of it arrives at all
    await expect(page.getByText(areaCopy.loadFailed)).toHaveCount(0)
  })

  test('asks for no statements at all until an entry has been spent on them', async ({ page }) => {
    // A student inside one competition, and so outside every other
    await installHostedBackend(page, 'running')

    // How many reads of a set have reached the backend, whoever they were for
    let problemReads = 0

    // Counting each one on its way past
    await page.route(`${BACKEND_ORIGIN}/competitions/*/problems`, (route) => {
      // The read was made, whatever becomes of it
      problemReads++

      // And is answered by the fake behind this, which is what the whole surface reads through
      return route.fallback()
    })

    // Open the area of a competition they never entered
    await page.goto(areaPath(UNENTERED_COMPETITION_SLUG))

    // Which turns them away
    await expect(page).toHaveURL(/\/mathilding$/, { timeout: SETTLE_TIMEOUT_MS })

    // Having asked for none of its statements: they are embargoed until an entry is spent on them, and
    // a page that asks anyway leans on the backend to say no
    expect(problemReads).toBe(0)
  })

  test('keeps the competition it is on when the reader changes language', async ({ page }) => {
    // A student inside a competition
    await installHostedBackend(page, 'running')

    // Open its area
    await page.goto(areaPath(COMPETITION_SLUG))

    // Once the area is there to switch away from
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The language switcher
    await page.getByRole('button', { name: /Change language/i }).click()

    // Taken to Slovak
    await page.getByRole('menuitem', { name: /Sloven/i }).click()

    // Which re-expresses the route and the slug, both in the language switched to
    await expect(page).toHaveURL(new RegExp(`/sk/mathildovanie/${COMPETITION_SLUG}-sk`), {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('refuses an entry into a group that has not opened', async ({ page }) => {
    // An ordinary student, held to every window
    await installHostedBackend(page, 'ready')

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the competition whose group is still only announced
    const row = page.locator(`[data-competition-slug="${UPCOMING_COMPETITION_SLUG}"]`)

    // Which is there to read
    await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And offers no way in: the group decides, and this one takes nobody yet
    await expect(row.getByRole('button', { name: areaCopy.enter, exact: true })).toHaveCount(0)
  })

  test('turns a reader away from a competition that has not opened', async ({ page }) => {
    // An ordinary student, held to every window
    await installHostedBackend(page, 'ready')

    // How many reads of a set reach the backend, whoever they were for
    let problemReads = 0

    // Counting each one on its way past
    await page.route(`${BACKEND_ORIGIN}/competitions/*/problems`, (route) => {
      // The read was made, whatever becomes of it
      problemReads++

      // And is answered by the fake behind this
      return route.fallback()
    })

    // Walk straight at the area of a competition nobody can be in yet
    await page.goto(areaPath(UPCOMING_COMPETITION_SLUG))

    // Which sends them back to the list
    await expect(page).toHaveURL(/\/mathilding$/, { timeout: SETTLE_TIMEOUT_MS })

    // Told the competition has yet to open, rather than that they have yet to start it
    await expect(page.getByText(areaCopy.areaNotOpen)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Having asked for none of its statements, which are embargoed until the competition is over
    expect(problemReads).toBe(0)
  })

  test('takes an entry from a reader past the gates before the group opens', async ({ page }) => {
    // One of the accounts the site lets past the gates its competitions are entered through
    await installHostedBackend(page, 'gates-bypassed')

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the competition whose group is still only announced
    const row = page.locator(`[data-competition-slug="${UPCOMING_COMPETITION_SLUG}"]`)

    // The way in they are offered
    const enter = row.getByRole('button', { name: areaCopy.enter, exact: true })

    // Which is there, with nothing said about the profile they never filled in
    await expect(enter).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // On a card still counting down to the day the group opens: the grant decides what is offered, and the
    // board goes on saying what the schedule is
    await expect(page.getByText(/opens in/i).first()).toBeVisible()

    // Press it, which raises the question rather than the profile the fields would otherwise be wanted for
    await enter.click()

    // The question itself
    const confirm = page.getByRole('button', { name: areaCopy.dialog.confirm })
    await expect(confirm).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Carrying no rules to accept: they are the terms a competitor is held to, and this one is not one
    await expect(page.getByText(areaCopy.rules.title)).toHaveCount(0)

    // Answered
    await confirm.click()

    // Which lands them in the area with the whole set, the window having refused nobody
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test('lets a reader past the gates into a competition that has not opened', async ({ page }) => {
    // One of the accounts the site lets past the gates its competitions are entered through
    await installHostedBackend(page, 'gates-bypassed')

    // Walk straight at the area of the competition nobody else can be in yet
    await page.goto(areaPath(UPCOMING_COMPETITION_SLUG))

    // Which draws the whole set rather than sending them back to the list
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // And none of the official solutions: the round's embargo still stands and no run of theirs has ended
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)
  })

  test('offers no way into a competition whose problems are not picked yet', async ({ page }) => {
    // A reader let past everything a competition puts in the way
    await installHostedBackend(page, 'gates-bypassed')

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the category announced before its problems were chosen
    const row = page.locator(`[data-competition-slug="${UNFILLED_COMPETITION_SLUG}"]`)

    // Which is on the board to read
    await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // And offers no press, the site having no paper to hand back for the entry
    await expect(row.getByRole('button', { name: areaCopy.enter, exact: true })).toHaveCount(0)

    // While the category beside it, on the same dates in the same group, does offer one
    await expect(
      page
        .locator(`[data-competition-slug="${UPCOMING_COMPETITION_SLUG}"]`)
        .getByRole('button', { name: areaCopy.enter, exact: true })
    ).toBeVisible()
  })

  test('runs a clock on a reader who entered past the gates', async ({ page }) => {
    // A reader let past the gates, taking the entry into a competition nobody else can be in yet
    await installHostedBackend(page, 'gates-bypassed')

    // Open the list
    await page.goto(LIST_PATH)

    // The row of the competition whose group is still only announced
    const row = page.locator(`[data-competition-slug="${UPCOMING_COMPETITION_SLUG}"]`)

    // Press in through the card, which is the only way a clock ever starts
    await row.getByRole('button', { name: areaCopy.enter, exact: true }).click()

    // And answer the question it raises
    await page.getByRole('button', { name: areaCopy.dialog.confirm }).click()

    // Which serves them the whole set
    await expect(page.getByRole('article')).toHaveCount(PROBLEM_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Holding the answers back behind the clock that just started, the same as anybody else's
    await expect(
      page.getByRole('button', { name: areaCopy.officialSolution, exact: true })
    ).toHaveCount(0)
  })
})
