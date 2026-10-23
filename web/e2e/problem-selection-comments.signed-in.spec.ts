import type { Locator, Page } from '@playwright/test'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import {
  detailQuery,
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
  ALGEBRA,
  BILINGUAL,
  cardOf,
  DRAFT_BOARD,
  FIRST,
  GEOMETRY,
  headingOf,
  LANDING_WINDOW_MS,
  OPENED,
  OPENED_COMMENT,
  openPool,
  pluralText,
  READY,
  rememberedSelection,
  selectedTab,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SET_ASIDE,
  SETTLE_TIMEOUT_MS,
  stubSelection,
  tabRowOn,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** The copy a thread reads under. */
const commentsCopy = messages.comments

/** The elementary paper of the board on screen. */
const ELEMENTARY = DRAFT_BOARD.papers[0]

/** Where the pool lives, laid out as its discussions. */
const COMMENTS_ADDRESS = `${SELECTION_PATH}?${POOL_VIEW_PARAM}=comments`

/** What Zuzana asks in {@link FIRST}'s discussion. */
const FIRST_REMARK = 'Is this not too easy?'

/** What Martin's reply in {@link FIRST}'s discussion says, the newest post a test starts with. */
const LATE_REPLY = 'Then it should go into the intermediate paper.'

/** What the reader replies in {@link GEOMETRY}'s discussion. */
const READER_REPLY = 'Too hard for the advanced paper, I think.'

/** What Martin says in the elementary paper's discussion. */
const PAPER_REMARK = 'The paper needs an easier opener.'

/** What Zuzana replies in {@link GEOMETRY}'s discussion while the reader has the tab open. */
const COLLEAGUE_REPLY = 'Surely too hard for the intermediate paper.'

/** What Martin replies in {@link FIRST}'s discussion after {@link COLLEAGUE_REPLY}. */
const NEWER_REPLY = 'Or as the opener of the second day.'

/** What the reader writes as a new comment on {@link GEOMETRY}'s own page. */
const READER_COMMENT = 'On second thought, it fits the intermediate paper.'

/** What Martin says in {@link GEOMETRY}'s discussion, its oldest comment. */
const GEOMETRY_REMARK = 'A lovely configuration.'

/** What Zuzana says in {@link GEOMETRY}'s discussion beside Martin's comment. */
const SECOND_REMARK = 'The second part could stand alone.'

/** What the reader says in {@link GEOMETRY}'s discussion, posted just after {@link PAPER_REMARK}. */
const OWN_REMARK = 'Maybe as the opener of the advanced paper?'

/** What the comments a test here finds marked as new say, each telling its comment apart. */
const MARKABLE_TEXTS = [
  OPENED_COMMENT.content,
  FIRST_REMARK,
  LATE_REPLY,
  PAPER_REMARK,
  COLLEAGUE_REPLY,
  NEWER_REPLY,
  GEOMETRY_REMARK,
]

/** What Zuzana says in {@link SET_ASIDE}'s discussion. */
const SET_ASIDE_REMARK = 'Set aside until its solution is fixed.'

/** A remark long enough that a few threads of it reach far past the bottom of the window. */
const LONG_REMARK = Array.from(
  { length: 40 },
  (_unused, index) => `Point ${index + 1} of a long remark.`
).join('\n\n')

/** Where the pool's discussions are read, all of them at once. */
const DISCUSSIONS_ADDRESS = `${SELECTION_ENDPOINT}/comments`

/** Where the backend keeps how far the reader has seen the discussions. */
const SEEN_ADDRESS = `${SELECTION_ENDPOINT}/comments/seen`

/**
 * The moment a test has the reader seen every discussion up to: after the elementary paper's remark, before
 * {@link OPENED_COMMENT} and the reply in {@link FIRST}'s discussion.
 */
const SEEN_UP_TO = '2026-09-26T00:00:00.000Z'

declare global {
  interface Window {
    /** Hands the test run what the notice that something waits says, each time it changes. */
    reportWhatsNewNotice: (text: string) => void
    /** Brings on screen a page the test put out of sight. */
    showPage: () => void
    /** Puts out of sight a page the test keeps on screen, as the reader does switching to another browser tab. */
    hidePage: () => void
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
    commentOf('c-first', 'Zuzana', FIRST_REMARK, '2026-09-20T08:00:00.000Z', [
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
  return page
    .getByText(pluralText('comments', { count }), { exact: true })
    .locator('xpath=ancestor::p[1]')
}

/**
 * The comments drawn as new to the reader, by what they say, in the order they read.
 *
 * @param scope - Where to look: the page, or one part of it.
 *
 * @returns What each says, among {@link MARKABLE_TEXTS}.
 */
function newCommentTexts(scope: Page | Locator): Promise<string[]> {
  // Each mark of a new comment, read back to what the comment carrying it says
  return scope.getByText(commentsCopy.newMark, { exact: true }).evaluateAll((marks, texts) => {
    // A function which reads the comment text an element holds, if it holds one
    const textIn = (element: Element) =>
      texts.find((text) => element.textContent?.includes(text) === true)

    // A function which reads the text of the nearest element around the mark holding one, the mark's own comment's
    const textAround = (element: Element | null): string =>
      element === null ? '' : (textIn(element) ?? textAround(element.parentElement))

    // Each mark's comment
    return marks.map(textAround)
  }, MARKABLE_TEXTS)
}

/**
 * Every discussion the backend holds, marked seen by the reader up to {@link SEEN_UP_TO}.
 *
 * @param memory - What the backend holds.
 */
function seeEverything(memory: ReturnType<typeof rememberedSelection>): void {
  // Each discussion the backend holds, seen up to the moment
  memory.discussions.forEach((_comments, key) => memory.seen.marks.set(key, SEEN_UP_TO))
}

/**
 * What the line over the pool says while it counts the comments its threads hold.
 *
 * @param count - How many comments it counts.
 * @param fresh - How many of them are new to the reader.
 *
 * @returns The line's text.
 */
function lineText(count: number, fresh: number): string {
  // The count, then how many are new where any are
  return fresh === 0
    ? pluralText('comments', { count })
    : `${pluralText('comments', { count })}, ${selectionText('pool.newCount', { count: fresh })}`
}

/**
 * A reply under each comment in a problem's discussion, in what the backend holds.
 *
 * @param memory - What the backend holds.
 * @param proposal - The problem.
 * @param reply - The reply.
 */
function replyIn(
  memory: ReturnType<typeof rememberedSelection>,
  proposal: Proposal,
  reply: CommentDto
): void {
  // Where the backend keeps the problem's discussion
  const key = threadKey('Proposal', proposal.id)

  // Each comment in the problem's discussion, answered by the reply
  memory.discussions.set(
    key,
    (memory.discussions.get(key) ?? []).map((posted) => ({
      ...posted,
      replies: [...posted.replies, reply],
    }))
  )
}

/**
 * Zuzana answering the comment in {@link GEOMETRY}'s discussion, in what the backend holds.
 *
 * @param memory - What the backend holds.
 */
function answerGeometry(memory: ReturnType<typeof rememberedSelection>): void {
  // Zuzana's reply, after everything the discussions start with
  replyIn(
    memory,
    GEOMETRY,
    commentOf('c-news', 'Zuzana', COLLEAGUE_REPLY, '2026-10-02T08:00:00.000Z')
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

/**
 * Puts whether the page is on screen in the test's hands, through {@link Window.showPage} and {@link Window.hidePage},
 * as the reader brings a browser tab up or puts it behind another.
 *
 * @param page - The page.
 * @param initially - Whether the page opens on screen or out of sight.
 */
async function stubPageVisibility(page: Page, initially: DocumentVisibilityState): Promise<void> {
  // The page's visibility, as the test sets it
  await page.addInitScript((startsAs: DocumentVisibilityState) => {
    // Whether the page is on screen
    let visibility = startsAs

    // What the page says about being on screen
    Object.defineProperty(document, 'visibilityState', { get: () => visibility })

    // A function which brings the page on screen or puts it out of sight, saying so up to the window as a browser does
    const turnTo = (next: DocumentVisibilityState) => {
      // On screen or out of sight
      visibility = next

      // Said so
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    }

    // The ways to bring the page on screen and to put it out of sight
    window.showPage = () => turnTo('visible')
    window.hidePage = () => turnTo('hidden')
  }, initially)
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

    // The line over the pool counting the threads' comments alone, every one of them new
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 6))

    // The pool laid out as its problems again
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The search box still holding the problem searched for
    await expect(search).toHaveValue(READY.title)

    // The pool laid out as its discussions once more
    await poolView(page, selectionCopy.pool.views.comments).click()

    // The threads' comments counted again, none new any more, the tab's first visit having marked them seen
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 0))
  })

  test('says when the discussions could not be read, reads them again on asking, and marks them seen once they show', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

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

    // The backend told what the threads show was seen, now that they show
    await expect.poll(() => memory.seen.writes.length).toBe(1)
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

  test('comes back from a problem opened far down a long list to its thread, the threads far above it not drawn', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Three long threads, each newer than every thread the selection starts with
    ;[READY, ALGEBRA, BILINGUAL].forEach((proposal, index) => {
      memory.discussions.set(threadKey('Proposal', proposal.id), [
        commentOf(
          `c-long-${proposal.number}`,
          'Martin',
          LONG_REMARK,
          `2026-10-1${index + 1}T08:00:00.000Z`
        ),
      ])
    })

    // A selection whose problems and paper are discussed, three of them at length
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // The newest long thread on top
    await expect(threadHeadings(page).first()).toHaveText(headingText(BILINGUAL), {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The heading of the geometry problem's thread, the oldest
    const geometryLink = threadOf(page, GEOMETRY).getByRole('link').first()

    // The page scrolled to its bottom until that thread is drawn, the bottom moving as threads coming into view are
    // measured
    await expect
      .poll(async () => {
        // The page at its bottom as it stands
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

        // Whether the thread is drawn yet
        return geometryLink.count()
      })
      .toBe(1)

    // The newest thread, far above, no longer drawn
    await expect(threadOf(page, BILINGUAL)).toHaveCount(0)

    // The geometry problem, opened from its thread's heading
    await geometryLink.click()

    // The geometry problem on its own page
    await expect(headingOf(page, GEOMETRY)).toBeVisible()

    // Back
    await page.goBack()

    // The thread again, in view, the focus on its heading
    await expect(geometryLink).toBeFocused()
    await expect(geometryLink).toBeInViewport()
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

test.describe("what is new in the pool's discussions", () => {
  test("marks every comment somebody else posted as new where nothing was seen, never the reader's own, and tells the backend each discussion was seen up to the newest of them", async ({
    page,
  }) => {
    // What the backend keeps, none of it ever seen
    const memory = discussedSelection()

    // The reader's own remark in the geometry problem's discussion
    addToGeometry(memory, {
      ...commentOf('c-own', 'Reader', OWN_REMARK, '2026-09-27T08:00:00.000Z'),
      author: { id: READER_ID, name: READER_NAME, avatarUrl: null },
    })

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The backend's answer to the mark the visit writes
    const told = page.waitForResponse(
      (response) => response.url() === SEEN_ADDRESS && response.request().method() === 'PUT',
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Five of the six comments new, the line saying so
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 5), { timeout: SETTLE_TIMEOUT_MS })

    // Everybody else's comments, the reader's own left plain
    expect((await newCommentTexts(page)).toSorted()).toEqual(
      [OPENED_COMMENT.content, FIRST_REMARK, LATE_REPLY, PAPER_REMARK, GEOMETRY_REMARK].toSorted()
    )

    // The backend told once that each discussion the tab shows was seen up to its newest comment by somebody else
    await expect
      .poll(() => memory.seen.writes)
      .toEqual([
        {
          proposals: {
            [FIRST.id]: '2026-10-01T08:00:00.000Z',
            [GEOMETRY.id]: '2026-09-10T08:00:00.000Z',
            [OPENED.id]: OPENED_COMMENT.createdAt,
          },
          papers: { [ELEMENTARY.id]: '2026-09-25T08:00:00.000Z' },
        },
      ])

    // The backend's answer arrived
    await told

    // Long enough for it to have landed
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The same five still new, for the rest of the visit, with nothing more told
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 5))
    expect(memory.seen.writes).toHaveLength(1)
  })

  test('counts as new only what was posted after the mark, never an older comment edited or reacted to since', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Every discussion seen up to the mark
    seeEverything(memory)

    // The geometry remark edited and liked after the mark
    memory.discussions.set(threadKey('Proposal', GEOMETRY.id), [
      {
        ...commentOf('c-geometry', 'Martin', GEOMETRY_REMARK, '2026-09-10T08:00:00.000Z'),
        editedAt: '2026-10-05T08:00:00.000Z',
        reactions: [{ userId: 'user_zuzana', name: 'Zuzana', kind: 'thumbsUp' }],
      },
    ])

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Two new, the line saying so
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 2), { timeout: SETTLE_TIMEOUT_MS })

    // The reply in the first problem's thread and the opened problem's comment, top to bottom
    expect(await newCommentTexts(page)).toEqual([LATE_REPLY, OPENED_COMMENT.content])
  })

  test('keeps what was new through the visit, shows what waited behind the button, and drops the rest next visit', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Every discussion seen up to the mark
    seeEverything(memory)

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Two of their comments new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 2), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what they show was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // Zuzana answering the geometry problem's comment after the visit's mark
    answerGeometry(memory)

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The button the reply waits behind
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // What was new still new, the reply waiting
    await expect(whatsNew).toBeVisible()
    expect(await newCommentTexts(page)).toEqual([LATE_REPLY, OPENED_COMMENT.content])

    // What waited, shown
    await whatsNew.click()

    // The reply new too, its thread first
    await expect
      .poll(() => newCommentTexts(page))
      .toEqual([COLLEAGUE_REPLY, LATE_REPLY, OPENED_COMMENT.content])

    // The pool laid out as its problems
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The pool laid out as its discussions again
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Only the reply that arrived during the last visit still new
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 1), { timeout: SETTLE_TIMEOUT_MS })
    expect(await newCommentTexts(page)).toEqual([COLLEAGUE_REPLY])
  })

  test("tells the backend nothing while the tab's own read is out, then marks seen what it brought", async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Every discussion seen up to the mark
    seeEverything(memory)

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // Every read of the discussions passing a gate, open to begin with
    const gate = await gateReads(page, DISCUSSIONS_ADDRESS)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Two of their comments new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 2), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what they show was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The pool laid out as its problems
    await poolView(page, selectionCopy.pool.views.problems).click()

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The gate, shut
    const release = gate.hold()

    // The pool laid out as its discussions again, their read held at the gate
    await poolView(page, selectionCopy.pool.views.comments).click()

    // The threads as the last visit left them
    await expect(countLineOf(page, 5)).toBeVisible()

    // Long enough for a mark to have gone out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did while the read was out
    expect(memory.seen.writes).toHaveLength(1)

    // The read let through
    release()

    // The backend told the geometry problem was seen up to the reply once the reply shows
    await expect
      .poll(() => memory.seen.writes[1]?.proposals[GEOMETRY.id])
      .toBe('2026-10-02T08:00:00.000Z')

    // The reply new for the rest of the visit
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 1))
    expect(await newCommentTexts(page)).toEqual([COLLEAGUE_REPLY])
  })

  test("opens again on what the last visit marked seen, though the backend hasn't answered yet", async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The gate every mark written waits at
    const gate = createAnswerGate()

    // The gate, shut until the test lets the mark through
    const release = gate.hold()

    // Each mark written held at the gate
    await page.route(SEEN_ADDRESS, async (route) => {
      // A mark waiting at the gate
      if (route.request().method() === 'PUT') await gate.passed()

      // Then answered by the fake behind this
      await route.fallback()
    })

    // The mark the visit writes, as it leaves
    const sent = page.waitForRequest(
      (request) => request.url() === SEEN_ADDRESS && request.method() === 'PUT',
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The visit's mark on its way
    await sent

    // The pool laid out as its problems, the mark still waiting
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The pool laid out as its discussions again
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Nothing new, the mark still on its way counted in
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 0))

    // The mark let through
    release()
  })

  test("marks what the tab shows as seen with the eye, which then goes, and the cards' counts with it", async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool
    await openPool(page)

    // The first problem's comment count standing out
    await expect(tabRowOn(cardOf(page, FIRST), 'comments', 2, true)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The pool's discussions
    await poolView(page, selectionCopy.pool.views.comments).click()

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what the tab shows was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new, the eye gone and the focus on the line
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 0))
    expect(await newCommentTexts(page)).toEqual([])
    await expect(page.getByRole('button', { name: selectionCopy.comments.markSeen })).toHaveCount(0)
    await expect(countLineOf(page, 5)).toBeFocused()

    // The backend told again that every discussion the tab shows was seen, each up to its newest comment
    await expect.poll(() => memory.seen.writes.length).toBe(2)
    expect(memory.seen.writes.at(-1)).toEqual({
      proposals: {
        [FIRST.id]: '2026-10-01T08:00:00.000Z',
        [GEOMETRY.id]: '2026-09-10T08:00:00.000Z',
        [OPENED.id]: OPENED_COMMENT.createdAt,
      },
      papers: { [ELEMENTARY.id]: '2026-09-25T08:00:00.000Z' },
    })

    // The pool's problems again
    await poolView(page, selectionCopy.pool.views.problems).click()

    // The first problem's comment count plain
    await expect(tabRowOn(cardOf(page, FIRST), 'comments', 2)).toBeVisible()
  })

  test('leaves new a waiting reply, though a problem opened meanwhile read a newer comment', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // Zuzana answering the geometry problem's comment meanwhile, after everything the list shows
    answerGeometry(memory)

    // Martin answering in the first problem's discussion later still
    replyIn(memory, FIRST, commentOf('c-newer', 'Martin', NEWER_REPLY, '2026-10-03T08:00:00.000Z'))

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Martin's reply read into the first problem's discussion as it opens
    await expect(page.getByRole('tabpanel')).toContainText(NEWER_REPLY, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // The button Zuzana's reply waits behind
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // The button standing over the list
    await expect(whatsNew).toBeVisible()

    // Martin's reply in the first problem's thread already
    await expect(threadOf(page, FIRST)).toContainText(NEWER_REPLY)

    // The eye pressed while Zuzana's reply waits
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing the list shows is new any more
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 0))

    // What waited, shown
    await whatsNew.click()

    // Zuzana's reply in, and new, though it is older than Martin's
    await expect(countLineOf(page, 7)).toHaveText(lineText(7, 1))
    expect(await newCommentTexts(page)).toEqual([COLLEAGUE_REPLY])
  })

  test("opens a problem from the pool's discussions on the same marks, its own tab offering the eye", async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what they show was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The first problem opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The problem's discussion
    const panel = page.getByRole('tabpanel')

    // As new as it was in the list
    await expect.poll(() => newCommentTexts(panel)).toEqual([FIRST_REMARK, LATE_REPLY])

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new in it any more
    await expect.poll(() => newCommentTexts(panel)).toEqual([])

    // Back to the pool
    await page.goBack()

    // The problem's thread not new there either
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 3), { timeout: SETTLE_TIMEOUT_MS })
    expect(await newCommentTexts(page)).toEqual([
      OPENED_COMMENT.content,
      PAPER_REMARK,
      GEOMETRY_REMARK,
    ])
  })

  test("says no more that a problem's comments hold news once the pool's visit told the backend, the pool keeping them new", async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what they show was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The paper opened from its thread's heading
    await page.getByRole('link', { name: `${ELEMENTARY.name} ${DRAFT_BOARD.name}` }).click()

    // The paper's problems
    await page.getByRole('tab', { name: selectionCopy.paper.problemsTab }).click()

    // The first problem's comment count plain on its card among them
    await expect(tabRowOn(cardOf(page, FIRST), 'comments', 2)).toBeVisible()

    // Back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Every comment still new in the pool
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5))
  })

  test("marks a paper's discussion seen with the eye on its own tab, the focus staying in the discussion", async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The elementary paper's discussion
    await page.goto(
      `${SELECTION_PATH}?${detailQuery({ kind: 'paper', id: ELEMENTARY.id, tab: 'comments' })}`
    )

    // The paper's discussion
    const panel = page.getByRole('tabpanel')

    // Martin's remark new in it
    await expect
      .poll(() => newCommentTexts(panel), { timeout: SETTLE_TIMEOUT_MS })
      .toEqual([PAPER_REMARK])

    // The backend told the paper's discussion was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new in it any more
    await expect.poll(() => newCommentTexts(panel)).toEqual([])

    // The focus handed to the discussion as the eye left
    await expect
      .poll(() => panel.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)

    // The backend told again that the paper's discussion was seen up to its remark
    await expect.poll(() => memory.seen.writes.length).toBe(2)
    expect(memory.seen.writes.at(-1)).toEqual({
      proposals: {},
      papers: { [ELEMENTARY.id]: '2026-09-25T08:00:00.000Z' },
    })
  })

  test('tells the backend nothing about a problem opened on its conversations until its discussion shows, nor about the pool behind it until the pool shows', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The first problem on its conversations, opened over the pool laid out as its discussions
    await page.goto(
      `${COMMENTS_ADDRESS}&${detailQuery({ kind: 'proposal', id: FIRST.id, tab: 'conversations' })}`
    )

    // The problem's conversations showing
    await expect(selectedTab(page, selectionCopy.detail.tabsLabel)).toContainText(
      selectionCopy.detail.conversationsTab,
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // Long enough for a mark to have gone out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did
    expect(memory.seen.writes).toEqual([])

    // The problem's discussion
    await page.getByRole('tab', { name: new RegExp(selectionCopy.detail.commentsTab) }).click()

    // The backend told the problem alone was seen, up to Martin's reply
    await expect
      .poll(() => memory.seen.writes)
      .toEqual([{ proposals: { [FIRST.id]: '2026-10-01T08:00:00.000Z' }, papers: {} }])

    // Back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The pool's discussions told as they show
    await expect.poll(() => memory.seen.writes.length).toBe(2)

    // The problem read on its page no longer new there
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 3))
    expect(await newCommentTexts(page)).toEqual([
      OPENED_COMMENT.content,
      PAPER_REMARK,
      GEOMETRY_REMARK,
    ])
  })

  test('tells the backend nothing about a discussion opened in a browser tab out of sight, until it comes on screen', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The page out of sight, as a link opened in a browser tab of its own behind the one the reader reads
    await stubPageVisibility(page, 'hidden')

    // The first problem's discussion, opened out of sight
    await page.goto(
      `${SELECTION_PATH}?${detailQuery({ kind: 'proposal', id: FIRST.id, tab: 'comments' })}`
    )

    // Martin's reply in it
    await expect(page.getByRole('tabpanel')).toContainText(LATE_REPLY, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Long enough for a mark to have gone out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did
    expect(memory.seen.writes).toEqual([])

    // The page brought on screen
    await page.evaluate(() => window.showPage())

    // The backend told the problem was seen, up to Martin's reply
    await expect
      .poll(() => memory.seen.writes)
      .toEqual([{ proposals: { [FIRST.id]: '2026-10-01T08:00:00.000Z' }, papers: {} }])
  })

  test('tells the backend nothing about what a read brought while the page was out of sight, until the page comes back', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The page on screen, for the test to put out of sight and back
    await stubPageVisibility(page, 'visible')

    // Every read of the discussions passing a gate, open to begin with
    const gate = await gateReads(page, DISCUSSIONS_ADDRESS)

    // The pool
    await openPool(page)

    // The first problem's comment count standing out, the reader's marks read
    await expect(tabRowOn(cardOf(page, FIRST), 'comments', 2, true)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The gate, shut
    const release = gate.hold()

    // The discussions' read, as it goes out
    const held = page.waitForRequest(DISCUSSIONS_ADDRESS, { timeout: SETTLE_TIMEOUT_MS })

    // The pool laid out as its discussions
    await poolView(page, selectionCopy.pool.views.comments).click()

    // The discussions' read out, held at the gate
    await held

    // The page put out of sight
    await page.evaluate(() => window.hidePage())

    // The read let through, landing while the page is out of sight
    release()

    // Every comment in, and new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // Long enough for a mark to have gone out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did
    expect(memory.seen.writes).toEqual([])

    // The page back on screen
    await page.evaluate(() => window.showPage())

    // The backend told what the threads show was seen, now that they show
    await expect.poll(() => memory.seen.writes.length).toBe(1)
  })

  test("says beside a folded thread's reply count that a reply it hides is new", async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed, nothing in it ever seen
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The first problem's thread folded, Martin's new reply under it
    await threadOf(page, FIRST).getByRole('button', { name: commentsCopy.hideReplies }).click()

    // The fold's button saying a reply it hides is new
    await expect(
      threadOf(page, FIRST).getByRole('button', {
        name: `${commentsCopy.show} ${pluralText('replies', { count: 1 })} ${messages.ui.content.includingNew}`,
        exact: true,
      })
    ).toBeVisible()
  })
})
