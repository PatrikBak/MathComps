import type { Locator, Page } from '@playwright/test'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import {
  OPEN_PAPER_PARAM,
  OPEN_PROPOSAL_PARAM,
  POOL_VIEW_PARAM,
} from '@/components/features/problem-selection/model/selection-routes'
import type { Proposal } from '@/components/features/problem-selection/model/selection-types'

import messages from '../messages/en.json'
import { createAnswerGate, gateReads } from './support/answer-gate'
import { BACKEND_ORIGIN, refuse } from './support/backend-routes'
import {
  READER_ID,
  READER_NAME,
  sendComment,
  stubNamedReader,
  threadKey,
  THREADS_PATH,
} from './support/comments'
import { SELECTION_PATH } from './support/competitions'
import {
  addressedParam,
  DRAFT_BOARD,
  FIRST,
  GEOMETRY,
  headingOf,
  LANDING_WINDOW_MS,
  OPENED,
  openPool,
  pluralText,
  READY,
  rememberedSelection,
  selectedTab,
  selectionCopy,
  SET_ASIDE,
  SETTLE_TIMEOUT_MS,
  stubSelection,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** The copy a thread reads under. */
const commentsCopy = messages.comments

/** The elementary paper of the board on screen. */
const ELEMENTARY = DRAFT_BOARD.papers[0]

/** Where the pool lives, laid out as its discussions. */
const COMMENTS_ADDRESS = `${SELECTION_PATH}?${POOL_VIEW_PARAM}=comments`

/** What Martin's reply in {@link FIRST}'s discussion says, the newest post a test starts with. */
const LATE_REPLY = 'Then it should go into the intermediate paper.'

/** What the reader replies in {@link GEOMETRY}'s discussion. */
const READER_REPLY = 'Too hard for the advanced paper, I think.'

/** What Martin says in the elementary paper's discussion. */
const PAPER_REMARK = 'The paper needs an easier opener.'

/** What Zuzana replies in {@link GEOMETRY}'s discussion while the reader has the tab open. */
const COLLEAGUE_REPLY = 'Surely too hard for the intermediate paper.'

/** What the reader writes as a new comment on {@link GEOMETRY}'s own page. */
const READER_COMMENT = 'On second thought, it fits the intermediate paper.'

/** What Martin says in {@link GEOMETRY}'s discussion, its oldest comment. */
const GEOMETRY_REMARK = 'A lovely configuration.'

/** What Zuzana says in {@link GEOMETRY}'s discussion beside Martin's comment. */
const SECOND_REMARK = 'The second part could stand alone.'

/** What the reader says in {@link GEOMETRY}'s discussion, posted just after {@link PAPER_REMARK}. */
const OWN_REMARK = 'Maybe as the opener of the advanced paper?'

/** What Zuzana says in {@link SET_ASIDE}'s discussion. */
const SET_ASIDE_REMARK = 'Set aside until its solution is fixed.'

/** Where the pool's discussions are read, all of them at once. */
const DISCUSSIONS_ADDRESS = `${BACKEND_ORIGIN}/problem-selection/comments`

declare global {
  interface Window {
    /** Hands the test run what the notice that something waits says, each time it changes. */
    reportWhatsNewNotice: (text: string) => void
  }
}

/**
 * A comment by somebody other than the reader, posted on a day of autumn 2026.
 *
 * @param id - The comment's id.
 * @param author - Who wrote it.
 * @param content - What it says.
 * @param postedAt - When it was posted.
 * @param replies - Its replies.
 *
 * @returns The comment.
 */
function commentOf(
  id: string,
  author: string,
  content: string,
  postedAt: string,
  replies: CommentDto[] = []
): CommentDto {
  // The comment, never edited and with nothing reacted to it
  return {
    id,
    author: { id: `user_${author.toLowerCase()}`, name: author, avatarUrl: null },
    content,
    createdAt: postedAt,
    editedAt: null,
    isDeleted: false,
    reactions: [],
    replies,
  }
}

/**
 * The backend's memory for every case: the comment every selection test starts with under {@link OPENED}, a thread
 * under {@link FIRST} answered after it, one under the elementary paper before it, and one under {@link GEOMETRY}
 * older than all.
 *
 * @returns The memory.
 */
function discussedSelection(): ReturnType<typeof rememberedSelection> {
  // The memory every selection test starts from, with OPENED's comment in it
  const memory = rememberedSelection(null)

  // FIRST's thread, posted early and answered last of all
  memory.discussions.set(threadKey('Proposal', FIRST.id), [
    commentOf('c-first', 'Zuzana', 'Is this not too easy?', '2026-09-20T08:00:00.000Z', [
      commentOf('c-late', 'Martin', LATE_REPLY, '2026-10-01T08:00:00.000Z'),
    ]),
  ])

  // The elementary paper's thread
  memory.discussions.set(threadKey('SelectionPaper', ELEMENTARY.id), [
    commentOf('c-paper', 'Martin', PAPER_REMARK, '2026-09-25T08:00:00.000Z'),
  ])

  // GEOMETRY's thread, the oldest
  memory.discussions.set(threadKey('Proposal', GEOMETRY.id), [
    commentOf('c-geometry', 'Martin', GEOMETRY_REMARK, '2026-09-10T08:00:00.000Z'),
  ])

  // The memory
  return memory
}

/**
 * Every thread's heading in the pool's discussions, in the threads' order.
 *
 * @param page - The page.
 *
 * @returns The headings.
 */
function threadHeadings(page: Page): Locator {
  // The heading of every thread laid out
  return page.getByRole('article').getByRole('heading', { level: 2 })
}

/**
 * The heading of a problem's thread, as the pool's discussions name it.
 *
 * @param proposal - The problem.
 *
 * @returns What the heading says.
 */
function headingText(proposal: Proposal): string {
  // The number, then the working name
  return `#${proposal.number} ${proposal.title}`
}

/**
 * A problem's thread in the pool's discussions.
 *
 * @param page - The page.
 * @param proposal - The problem.
 *
 * @returns The thread.
 */
function threadOf(page: Page, proposal: Proposal): Locator {
  // The only thread headed by the problem
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 2, name: headingText(proposal) }) })
}

/**
 * The line over the pool, while it counts the comments its threads hold.
 *
 * @param page - The page.
 * @param count - How many comments it counts.
 *
 * @returns The line.
 */
function countLineOf(page: Page, count: number): Locator {
  // The line holding the count
  return page.getByText(pluralText('comments', { count }), { exact: true }).locator('..')
}

/**
 * Zuzana answering the comment in {@link GEOMETRY}'s discussion, in what the backend holds.
 *
 * @param memory - What the backend holds.
 */
function answerGeometry(memory: ReturnType<typeof rememberedSelection>): void {
  // Where the backend keeps the geometry problem's discussion
  const geometryKey = threadKey('Proposal', GEOMETRY.id)

  // Each comment in the geometry problem's discussion, answered by Zuzana
  memory.discussions.set(
    geometryKey,
    (memory.discussions.get(geometryKey) ?? []).map((posted) => ({
      ...posted,
      replies: [
        ...posted.replies,
        commentOf('c-news', 'Zuzana', COLLEAGUE_REPLY, '2026-10-02T08:00:00.000Z'),
      ],
    }))
  )
}

/**
 * A comment added to {@link GEOMETRY}'s discussion, in what the backend holds.
 *
 * @param memory - What the backend holds.
 * @param added - The comment.
 */
function addToGeometry(memory: ReturnType<typeof rememberedSelection>, added: CommentDto): void {
  // Where the backend keeps the geometry problem's discussion
  const geometryKey = threadKey('Proposal', GEOMETRY.id)

  // The comment, after the rest of the discussion
  memory.discussions.set(geometryKey, [...(memory.discussions.get(geometryKey) ?? []), added])
}

/**
 * Keeps every read of a single thread the page sends from here on.
 *
 * @param page - The page.
 *
 * @returns The reads, by their addresses, oldest first.
 */
function recordThreadReads(page: Page): string[] {
  // The reads so far
  const reads: string[] = []

  // Each call the page makes, watched as it leaves
  page.on('request', (request) => {
    // Kept when it reads one thread
    if (request.method() === 'GET' && new URL(request.url()).pathname === THREADS_PATH) {
      reads.push(request.url())
    }
  })

  // The reads
  return reads
}

/**
 * Records every change to the notice telling a screen reader that something waits, from now on. A notice that falls
 * silent and comes back within a round trip looks to a check taken afterwards like one that never moved, though a
 * screen reader hears it afresh each time it comes back.
 *
 * @param page - The page, its notice saying something waits.
 *
 * @returns A function reading what the notice said after each change so far, oldest first.
 */
async function recordWhatsNewNotice(page: Page): Promise<() => string[]> {
  // What the notice said after each change
  const changes: string[] = []

  // The channel the page hands each change back through
  await page.exposeFunction('reportWhatsNewNotice', (text: string) => {
    changes.push(text)
  })

  // The notice on the page already open, watched
  await page.evaluate((waiting) => {
    // The notice, saying something waits
    const notice = [...document.querySelectorAll('[role="status"]')].find(
      (element) => element.textContent === waiting
    )

    // None saying so, which would leave nothing to watch
    if (notice === undefined) throw new Error('No notice says something waits')

    // What it says handed over at each change, text arriving or leaving as much as a node
    new MutationObserver(() => window.reportWhatsNewNotice(notice.textContent ?? '')).observe(
      notice,
      {
        childList: true,
        subtree: true,
        characterData: true,
      }
    )
  }, selectionCopy.pool.showWhatsNew)

  // A function reading the changes so far
  return () => changes
}

/**
 * One layout of the pool, on its switch.
 *
 * @param page - The page.
 * @param name - What the layout is called.
 *
 * @returns The layout's option.
 */
function poolView(page: Page, name: string): Locator {
  // The option named so on the pool's switch
  return page
    .getByRole('radiogroup', { name: selectionCopy.pool.views.label })
    .getByRole('radio', { name })
}

test.describe("the pool's discussions", () => {
  test('lays the pool out as its threads, newest activity first, kept in the address so Back from a problem lands on it', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool
    await openPool(page)

    // Every read of a single thread, recorded from here on
    const threadReads = recordThreadReads(page)

    // The pool laid out as its discussions
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Every thread, the one answered last first, the paper's among the problems'
    await expect(threadHeadings(page)).toHaveText([
      headingText(FIRST),
      headingText(OPENED),
      `${ELEMENTARY.name} ${DRAFT_BOARD.name}`,
      headingText(GEOMETRY),
    ])

    // Long enough for a thread to have read itself, had it been asked to
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Each read in with the rest, none on its own
    expect(threadReads).toEqual([])

    // The late reply under its comment
    await expect(threadOf(page, FIRST)).toContainText(LATE_REPLY)

    // The layout, named in the address
    await expect.poll(() => addressedParam(page, POOL_VIEW_PARAM)).toBe('comments')

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem on its own page, on the discussion
    await expect(headingOf(page, FIRST)).toBeVisible()
    await expect(selectedTab(page, selectionCopy.detail.tabsLabel)).toContainText(
      selectionCopy.detail.commentsTab
    )
    await expect(page.getByRole('tabpanel')).toContainText(LATE_REPLY)

    // Back
    await page.goBack()

    // The discussions again, focus on the heading the problem was opened from
    await expect(threadHeadings(page)).toHaveCount(4)
    await expect(threadOf(page, FIRST).getByRole('link').first()).toBeFocused()

    // The paper's thread heading
    const paperHeading = page.getByRole('link', { name: `${ELEMENTARY.name} ${DRAFT_BOARD.name}` })

    // Followed
    await paperHeading.click()

    // The paper on its own page, on the discussion
    expect(await addressedParam(page, OPEN_PAPER_PARAM)).toBe(ELEMENTARY.id)
    await expect(selectedTab(page, selectionCopy.paper.tabsLabel)).toContainText(
      selectionCopy.paper.commentsTab
    )
    await expect(page.getByRole('tabpanel')).toContainText(PAPER_REMARK)

    // The paper's problems
    await page.getByRole('tab', { name: selectionCopy.paper.problemsTab }).click()

    // The first problem, opened from its name on the paper
    await page.getByRole('tabpanel').getByRole('link', { name: FIRST.title }).click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the paper
    await page.goBack()

    // Focus on the first problem's name on the paper
    await expect(page.getByRole('tabpanel').getByRole('link', { name: FIRST.title })).toBeFocused()

    // Back again, to the discussions
    await page.goBack()

    // The discussions again, focus on the paper's heading it was opened from rather than on its name on the board
    await expect(paperHeading).toBeFocused()
  })

  test("shows every discussion whatever the pool's filters, the set-aside problem's among them, with none of the filters over it", async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // The set-aside problem discussed too
    memory.discussions.set(threadKey('Proposal', SET_ASIDE.id), [
      commentOf('c-set-aside', 'Zuzana', SET_ASIDE_REMARK, '2026-09-15T08:00:00.000Z'),
    ])

    // A selection whose problems and paper are discussed, the set-aside problem among them
    await stubSelection(page, 'selection', memory)

    // The pool
    await openPool(page)

    // The pool's search box
    const search = page.getByRole('searchbox', { name: selectionCopy.pool.search })

    // Searched down to a problem nobody has discussed
    await search.fill(READY.title)

    // The pool laid out as its discussions
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Every thread, the set-aside problem's among them
    await expect(threadHeadings(page)).toHaveText([
      headingText(FIRST),
      headingText(OPENED),
      `${ELEMENTARY.name} ${DRAFT_BOARD.name}`,
      headingText(SET_ASIDE),
      headingText(GEOMETRY),
    ])

    // No search or facet over the threads
    await expect(search).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: selectionCopy.filters.category, exact: true })
    ).toHaveCount(0)

    // The line over the pool counting the threads' comments alone
    await expect(countLineOf(page, 6)).toHaveText(pluralText('comments', { count: 6 }))

    // The pool laid out as its problems again
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The search box still holding the problem searched for
    await expect(search).toHaveValue(READY.title)

    // The pool laid out as its discussions once more
    await poolView(page, selectionCopy.pool.views.comments).click()

    // The threads' comments counted again
    await expect(countLineOf(page, 6)).toHaveText(pluralText('comments', { count: 6 }))
  })

  test('says when the discussions could not be read, and reads them again on asking', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The discussions' first read refused for good, a refusal the read never tries again by itself
    await page.route(DISCUSSIONS_ADDRESS, (route) => refuse(route, 404, 'CommentTargetNotFound'), {
      times: 1,
    })

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // The read's failure told, in the line over the pool too
    await expect(page.getByText(selectionCopy.pool.commentsFailed)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
    await expect(
      page.getByText(selectionCopy.pool.commentsUnavailable, { exact: true })
    ).toBeVisible()

    // Read again on asking
    await page.getByRole('button', { name: messages.ui.actions.retry }).click()

    // Every thread in, and counted, the focus on the count where the button was
    await expect(threadHeadings(page)).toHaveCount(4)
    await expect(countLineOf(page, 5)).toBeFocused()
  })

  test('keeps the threads on screen when a later read fails', async ({ page }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // Every read of the discussions from here on refused for good
    await page.route(DISCUSSIONS_ADDRESS, (route) => refuse(route, 404, 'CommentTargetNotFound'))

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // The discussions' next read
    const refused = page.waitForResponse(DISCUSSIONS_ADDRESS)

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The discussions' read, refused
    await refused

    // Long enough for the refusal to have reached the screen, which shows nothing of it
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Every thread still there, counted, with nothing to retry
    await expect(threadHeadings(page)).toHaveCount(4)
    await expect(countLineOf(page, 5)).toBeVisible()
    await expect(page.getByRole('button', { name: messages.ui.actions.retry })).toHaveCount(0)
  })

  test('takes what others delete at once, with nothing waiting behind a button', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // Where the backend keeps the geometry problem's discussion
    const geometryKey = threadKey('Proposal', GEOMETRY.id)

    // Martin's comment on the geometry problem, which nobody answered, deleted meanwhile
    memory.discussions.set(
      geometryKey,
      (memory.discussions.get(geometryKey) ?? []).map((posted) => ({
        ...posted,
        isDeleted: true,
        content: '',
      }))
    )

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The geometry problem's thread gone
    await expect(threadHeadings(page)).toHaveCount(3)
    await expect(page.getByText(GEOMETRY_REMARK)).toHaveCount(0)

    // No button over a read that brought nothing else
    await expect(page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })).toHaveCount(0)
  })

  test("carries an open reply to the problem's page, and closes it in the list once it is sent there", async ({
    page,
  }) => {
    // A reader with a username, which a reply is signed with
    await stubNamedReader(page)

    // Whose selection's problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // A reply, opened under the geometry problem's comment
    await threadOf(page, GEOMETRY).getByRole('button', { name: commentsCopy.reply }).click()

    // The reply, half written
    await page.getByPlaceholder(commentsCopy.replyPlaceholder).fill(READER_REPLY)

    // The first problem, opened from its thread's heading meanwhile
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's page taking a new comment, the reply being open in another thread
    await expect(
      page.getByRole('tabpanel').getByPlaceholder(selectionCopy.comments.placeholder)
    ).toBeVisible()

    // Back to the pool
    await page.goBack()

    // The geometry problem, opened from its thread's heading
    await threadOf(page, GEOMETRY).getByRole('link').first().click()

    // The reply box on the geometry problem's page
    const replyBox = page.getByRole('tabpanel').getByPlaceholder(commentsCopy.replyPlaceholder)

    // The reply open there too, holding what was written
    await expect(replyBox).toHaveValue(READER_REPLY)

    // Sent from the keyboard
    await replyBox.press('Meta+Enter')

    // The reply taken into the discussion, its box closed
    await expect(page.getByRole('tabpanel')).toContainText(READER_REPLY)
    await expect(replyBox).toHaveCount(0)

    // Back to the pool
    await page.goBack()

    // The reply in its thread, and no box left open for it
    await expect(threadOf(page, GEOMETRY)).toContainText(READER_REPLY)
    await expect(page.getByPlaceholder(commentsCopy.replyPlaceholder)).toHaveCount(0)
  })

  test('holds what others write behind a button, which shows it and lays the threads out afresh', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // The order the threads open in
    const opening = await threadHeadings(page).allTextContents()

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // The button on screen
    await expect(whatsNew).toBeVisible()

    // That something waits, said to a screen reader too
    await expect(
      page.getByRole('status').filter({ hasText: selectionCopy.pool.showWhatsNew })
    ).toHaveCount(1)

    // Nothing moved meanwhile, the reply not in yet
    await expect(threadHeadings(page)).toHaveText(opening)
    await expect(threadOf(page, GEOMETRY)).not.toContainText(COLLEAGUE_REPLY)

    // What waits, shown
    await whatsNew.click()

    // The reply in, its thread first now, the button gone, the focus on the count where it was
    await expect(threadOf(page, GEOMETRY)).toContainText(COLLEAGUE_REPLY)
    await expect(threadHeadings(page).first()).toHaveText(headingText(GEOMETRY))
    await expect(whatsNew).toHaveCount(0)
    await expect(countLineOf(page, 6)).toBeFocused()
  })

  test('opens again on the threads it showed, at once, and lays them out afresh once its own read lands', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // Every read of the discussions passing a gate, open to begin with
    const gate = await gateReads(page, DISCUSSIONS_ADDRESS)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // The reply waiting behind the button
    await expect(whatsNew).toBeVisible()

    // The pool laid out as its problems
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The gate, shut
    const release = gate.hold()

    // The pool laid out as its discussions again, their read held at the gate
    await poolView(page, selectionCopy.pool.views.comments).click()

    // The threads as they were left, counted, with no button while the read is still out, the read they were left
    // with being an earlier visit's
    await expect(threadHeadings(page).last()).toHaveText(headingText(GEOMETRY))
    await expect(countLineOf(page, 5)).toBeVisible()
    await expect(whatsNew).toHaveCount(0)

    // The read let through
    release()

    // The reply in, its thread first, counted, with nothing waiting
    await expect(threadHeadings(page).first()).toHaveText(headingText(GEOMETRY))
    await expect(countLineOf(page, 6)).toBeVisible()
    await expect(whatsNew).toHaveCount(0)
  })

  test('keeps what others write behind the button when the reader reacts in its thread', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // The reply waiting behind the button
    await expect(whatsNew).toBeVisible()

    // Every read of a single thread, recorded from here on
    const threadReads = recordThreadReads(page)

    // Every change to the notice that something waits, recorded from here on
    const noticeChanges = await recordWhatsNewNotice(page)

    // The discussions' next read, which a read on their own schedule would leave half a minute off
    const reread = page.waitForResponse(DISCUSSIONS_ADDRESS, { timeout: SETTLE_TIMEOUT_MS })

    // A thumbs up given in the geometry problem's thread
    await threadOf(page, GEOMETRY).getByRole('button', { name: commentsCopy.thumbsUp }).click()

    // The thumbs up counted at once
    await expect(
      threadOf(page, GEOMETRY).getByRole('button', { name: `${commentsCopy.thumbsUp} 1` })
    ).toBeVisible()

    // The discussions read again once the press settles
    await reread

    // Long enough for the thread to have been read again, had the press asked for it, and for the read to land
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // No thread read on its own, so the reply still waits behind the button
    expect(threadReads).toEqual([])
    await expect(threadOf(page, GEOMETRY)).not.toContainText(COLLEAGUE_REPLY)

    // The button there throughout, its notice never falling silent to be heard again
    await expect(whatsNew).toBeVisible()
    expect(noticeChanges()).toEqual([])
  })

  test('shows what the backend took when one of two reactions pressed in a thread fails', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Zuzana's comment beside Martin's on the geometry problem
    addToGeometry(
      memory,
      commentOf('c-second', 'Zuzana', SECOND_REMARK, '2026-09-11T08:00:00.000Z')
    )

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The gate the first reaction pressed waits at
    const gate = createAnswerGate()

    // The first reaction pressed, failing once the gate lets it through
    await page.route(
      `${BACKEND_ORIGIN}/comments/*/reaction`,
      async (route) => {
        // Held at the gate
        await gate.passed()

        // Failed, the way a server falling over answers
        await route.fulfill({ status: 500 })
      },
      { times: 1 }
    )

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(5, { timeout: SETTLE_TIMEOUT_MS })

    // The two comments, each a thread of its own
    const martins = page.getByRole('article').filter({ hasText: GEOMETRY_REMARK })
    const zuzanas = page.getByRole('article').filter({ hasText: SECOND_REMARK })

    // The gate, shut
    const release = gate.hold()

    // A thumbs up on Martin's comment, stopped at the gate
    await martins.getByRole('button', { name: commentsCopy.thumbsUp }).click()

    // A thumbs up on Zuzana's comment, waiting behind Martin's
    await zuzanas.getByRole('button', { name: commentsCopy.thumbsUp }).click()

    // Martin's thumbs up let through, failing
    release()

    // The failure, told
    await expect(page.getByText(commentsCopy.errors.reactionFailed)).toBeVisible()

    // Zuzana's comment holding the thumbs up the backend took, Martin's none
    await expect(zuzanas.getByRole('button', { name: `${commentsCopy.thumbsUp} 1` })).toBeVisible()
    await expect(martins.getByRole('button', { name: `${commentsCopy.thumbsUp} 1` })).toHaveCount(0)
  })

  test("hands the focus to the paper's heading when the reader's own thread above it leaves", async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // The reader's own comment on the geometry problem, posted just after the comment on the paper
    addToGeometry(memory, {
      ...commentOf('c-own', 'Reader', OWN_REMARK, '2026-09-27T08:00:00.000Z'),
      author: { id: READER_ID, name: READER_NAME, avatarUrl: null },
    })

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every thread drawn, the reader's right above the paper's
    await expect(threadHeadings(page)).toHaveText(
      [
        headingText(FIRST),
        headingText(OPENED),
        headingText(GEOMETRY),
        `${ELEMENTARY.name} ${DRAFT_BOARD.name}`,
        headingText(GEOMETRY),
      ],
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // Delete, pressed on the reader's comment
    await page
      .getByRole('article')
      .filter({ hasText: OWN_REMARK })
      .getByRole('button', { name: commentsCopy.delete })
      .click()

    // The deletion confirmed
    await page.getByRole('dialog').getByRole('button', { name: commentsCopy.delete }).click()

    // The reader's thread gone, the focus on the paper's heading standing in its place
    await expect(threadHeadings(page)).toHaveCount(4)
    await expect(
      page.getByRole('link', { name: `${ELEMENTARY.name} ${DRAFT_BOARD.name}` })
    ).toBeFocused()
  })

  test("takes a reply in place and a new comment from the problem's page, each thread held where it stood until the tab opens again", async ({
    page,
  }) => {
    // A reviewer with a username, which a thread asks for before it takes a reply
    await stubNamedReader(page)

    // Whose selection's problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // A reply, opened under the first problem's comment
    await threadOf(page, FIRST).getByRole('button', { name: commentsCopy.reply }).first().click()

    // The reply opened under the geometry problem's comment instead
    await threadOf(page, GEOMETRY).getByRole('button', { name: commentsCopy.reply }).click()

    // The box a reply is written in
    const replyBox = page.getByPlaceholder(commentsCopy.replyPlaceholder)

    // The only reply box open, focused under the geometry problem's comment
    await expect(replyBox).toHaveCount(1)
    await expect(
      threadOf(page, GEOMETRY).getByPlaceholder(commentsCopy.replyPlaceholder)
    ).toBeFocused()

    // The discussions' read once the reply settles, which a read on their own schedule would leave half a
    // minute off
    const reread = page.waitForResponse(DISCUSSIONS_ADDRESS, { timeout: SETTLE_TIMEOUT_MS })

    // The reply, written
    await replyBox.fill(READER_REPLY)

    // Sent from the keyboard
    await replyBox.press('Meta+Enter')

    // The box closed once the reply is taken
    await expect(replyBox).toHaveCount(0)

    // The reply under its comment, signed by the reader
    await expect(threadOf(page, GEOMETRY)).toContainText(READER_REPLY)
    await expect(threadOf(page, GEOMETRY)).toContainText(READER_NAME)

    // The discussions read again
    await reread

    // Long enough for the read to land
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The thread the reply went into still last, where it stood as the tab opened
    await expect(threadHeadings(page).last()).toHaveText(headingText(GEOMETRY))

    // The geometry problem, opened from its thread's heading
    await threadOf(page, GEOMETRY).getByRole('link').first().click()

    // The geometry problem's page, its discussion holding the reply
    expect(await addressedParam(page, OPEN_PROPOSAL_PARAM)).toBe(GEOMETRY.id)
    await expect(page.getByRole('tabpanel')).toContainText(READER_REPLY)

    // A new comment, sent on the problem's own page
    await sendComment(page.getByPlaceholder(selectionCopy.comments.placeholder), READER_COMMENT)

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The new comment heading the tab at once, under the problem's heading, the replied thread still last
    await expect(threadHeadings(page)).toHaveCount(5)
    await expect(page.getByRole('article').first()).toContainText(READER_COMMENT)
    await expect(threadHeadings(page).first()).toHaveText(headingText(GEOMETRY))
    await expect(page.getByRole('article').last()).toContainText(READER_REPLY)

    // The pool laid out as its problems
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The pool laid out as its discussions again
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Ordered afresh: the new comment first, then the replied thread
    await expect(page.getByRole('article').first()).toContainText(READER_COMMENT)
    await expect(page.getByRole('article').nth(1)).toContainText(READER_REPLY)

    // The reply still the reader's own to edit, as the read gives it back
    await expect(
      page.getByRole('article').nth(1).getByRole('button', { name: commentsCopy.edit })
    ).toBeVisible()

    // Every thread's heading, the new comment's and the replied thread's above the rest as they were
    await expect(threadHeadings(page)).toHaveText([
      headingText(GEOMETRY),
      headingText(GEOMETRY),
      headingText(FIRST),
      headingText(OPENED),
      `${ELEMENTARY.name} ${DRAFT_BOARD.name}`,
    ])
  })
})
