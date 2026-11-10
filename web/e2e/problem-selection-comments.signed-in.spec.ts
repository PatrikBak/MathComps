import type { Locator, Page } from '@playwright/test'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import {
  detailQuery,
  OPEN_PAPER_PARAM,
  OPEN_PROPOSAL_PARAM,
  POOL_VIEW_PARAM,
} from '@/components/features/problem-selection/model/selection-routes'
import type {
  Board,
  Organization,
  Paper,
  Proposal,
} from '@/components/features/problem-selection/model/selection-types'
import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { locationParam } from './support/address'
import { createAnswerGate, gateReads } from './support/answer-gate'
import { facetsCopy } from './support/archive-filters'
import { BACKEND_ORIGIN, refuse, stubOwnOrganizations } from './support/backend-routes'
import {
  newCommentTexts,
  postedComment,
  READER_ID,
  READER_NAME,
  recordThreadReads,
  sendComment,
  stubNamedReader,
  threadKey,
} from './support/comments'
import { areaCopy, editorCopy, SELECTION_PATH } from './support/competitions'
import { stubPageVisibility } from './support/emulation'
import { pickPillAnswer, pickPillOption } from './support/facets'
import { openUserMenu, selectedTab } from './support/interaction'
import {
  ALGEBRA,
  BILINGUAL,
  cardOf,
  DRAFT_BOARD,
  FINALIZED_BOARD,
  FIRST,
  GEOMETRY,
  headingOf,
  LANDING_WINDOW_MS,
  LATER_DRAFT,
  ON_OFFER_COUNT,
  OPENED,
  OPENED_COMMENT,
  openPool,
  pickBoard,
  pluralText,
  READY,
  rememberedSelection,
  searchBox,
  SELECTION_ENDPOINT,
  selectionCopy,
  selectionText,
  SET_ASIDE,
  stubSelection,
  tabRowOn,
  USED,
} from './support/problem-selection'
import { MATHCOMPS_ORGANIZATION_SLUG } from './support/selection-writes'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'
import { recordStatusAnnouncements } from './support/watchers'

/** The copy a thread reads under. */
const commentsCopy = messages.comments

/** The elementary paper of the board on screen. */
const ELEMENTARY = DRAFT_BOARD.papers[0]

/** Where the pool lives, laid out as its discussions. */
const COMMENTS_ADDRESS = `${SELECTION_PATH}?${POOL_VIEW_PARAM}=comments`

/** A page other than the selection, with nothing on it but the header. */
const ABOUT_PATH = `/en${ROUTES.ABOUT}`

/** The organization whose selection is on screen, as the user menu lists it. */
const MATHCOMPS: Organization = { slug: MATHCOMPS_ORGANIZATION_SLUG, name: 'MathComps' }

/** What Zuzana asks in {@link FIRST}'s discussion. */
const FIRST_REMARK = 'Is this not too easy?'

/** What Martin's reply in {@link FIRST}'s discussion says, the newest post a test starts with. */
const LATE_REPLY = 'Then it should go into the intermediate paper.'

/** What the reader replies in {@link GEOMETRY}'s discussion. */
const READER_REPLY = 'Too hard for the advanced paper, I think.'

/** What the reader starts to reply in {@link GEOMETRY}'s discussion, naming {@link ALGEBRA} by number. */
const NUMBERED_REPLY = `What about #${ALGEBRA.number} instead?`

/** What Martin says in the elementary paper's discussion. */
const PAPER_REMARK = 'The paper needs an easier opener.'

/**
 * What Martin says in the elementary paper's discussion, naming two problems by number and a number no problem
 * carries.
 */
const NUMBERED_REMARK = `Open with #${ALGEBRA.number} rather than #${GEOMETRY.number}, and #999 is nobody.`

/** What Zuzana replies in {@link GEOMETRY}'s discussion while the reader has the tab open. */
const COLLEAGUE_REPLY = 'Surely too hard for the intermediate paper.'

/** What Martin replies in {@link FIRST}'s discussion after {@link COLLEAGUE_REPLY}. */
const NEWER_REPLY = 'Or as the opener of the second day.'

/** What the reader writes as a new comment on {@link GEOMETRY}'s own page. */
const READER_COMMENT = 'On second thought, it fits the intermediate paper.'

/** What Martin says in {@link GEOMETRY}'s discussion, its oldest comment. */
const GEOMETRY_REMARK = 'A lovely configuration.'

/** What Martin's comment in {@link GEOMETRY}'s discussion says once he edits it. */
const GEOMETRY_REMARK_EDITED = 'A known configuration, sadly.'

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
  SECOND_REMARK,
]

/** What Zuzana says in {@link SET_ASIDE}'s discussion. */
const SET_ASIDE_REMARK = 'Set aside until its solution is fixed.'

/** What Martin says in {@link USED}'s discussion. */
const USED_REMARK = 'Went well in the round.'

/** The finalized board's paper, which holds {@link USED}. */
const FINALIZED_PAPER = FINALIZED_BOARD.papers[0]

/** What Martin says in a new thread under {@link GEOMETRY}, which a search for "paper" finds. */
const PAPER_MENTIONING_REMARK = 'Better kept for a paper of its own.'

/** What Zuzana says in {@link FINALIZED_PAPER}'s discussion. */
const FINALIZED_PAPER_REMARK = 'Balanced as a whole.'

/** The heading of every thread {@link widelyDiscussed} holds but the set-aside problem's, newest activity first. */
const EVERY_LIVE_THREAD = [
  headingText(FIRST),
  headingText(OPENED),
  paperHeadingText(ELEMENTARY, DRAFT_BOARD),
  headingText(USED),
  paperHeadingText(FINALIZED_PAPER, FINALIZED_BOARD),
  headingText(GEOMETRY),
]

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
    postedComment('c-first', 'Zuzana', FIRST_REMARK, '2026-09-20T08:00:00.000Z', [
      postedComment('c-late', 'Martin', LATE_REPLY, '2026-10-01T08:00:00.000Z'),
    ]),
  ])

  // The elementary paper's thread
  memory.discussions.set(threadKey('SelectionPaper', ELEMENTARY.id), [
    postedComment('c-paper', 'Martin', PAPER_REMARK, '2026-09-25T08:00:00.000Z'),
  ])

  // GEOMETRY's thread, the oldest
  memory.discussions.set(threadKey('Proposal', GEOMETRY.id), [
    postedComment('c-geometry', 'Martin', GEOMETRY_REMARK, '2026-09-10T08:00:00.000Z'),
  ])

  // The memory
  return memory
}

/**
 * The backend's memory for the filters' cases: {@link discussedSelection}'s threads, with one under the set-aside
 * problem, one under the problem a round took, and one under the finalized board's paper besides.
 *
 * @returns The memory.
 */
function widelyDiscussed(): ReturnType<typeof rememberedSelection> {
  // The threads most cases start with
  const memory = discussedSelection()

  // The set-aside problem's thread
  memory.discussions.set(threadKey('Proposal', SET_ASIDE.id), [
    postedComment('c-set-aside', 'Zuzana', SET_ASIDE_REMARK, '2026-09-15T08:00:00.000Z'),
  ])

  // The taken problem's thread
  memory.discussions.set(threadKey('Proposal', USED.id), [
    postedComment('c-used', 'Martin', USED_REMARK, '2026-09-20T08:00:00.000Z'),
  ])

  // The finalized board's paper's thread
  memory.discussions.set(threadKey('SelectionPaper', FINALIZED_PAPER.id), [
    postedComment('c-finalized', 'Zuzana', FINALIZED_PAPER_REMARK, '2026-09-12T08:00:00.000Z'),
  ])

  // The memory
  return memory
}

/**
 * The heading of a paper's thread, as the pool's discussions name it.
 *
 * @param paper - The paper.
 * @param board - The board holding it.
 *
 * @returns What the heading says.
 */
function paperHeadingText(paper: Paper, board: Board): string {
  // The paper's name, then the board's
  return `${paper.name} ${board.name}`
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
    postedComment('c-news', 'Zuzana', COLLEAGUE_REPLY, '2026-10-02T08:00:00.000Z')
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
 * Lays the pool out as one of its layouts, returning once the switch has taken it.
 *
 * @param page - The page.
 * @param name - What the layout is called.
 */
async function showPoolAs(page: Page, name: string): Promise<void> {
  // The layout's option
  const option = poolView(page, name)

  // Picked
  await option.click()

  // Taken by the switch
  await expect(option).toBeChecked()
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
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // Every thread, the one answered last first, the paper's among the problems'
    await expect(threadHeadings(page)).toHaveText([
      headingText(FIRST),
      headingText(OPENED),
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
      headingText(GEOMETRY),
    ])

    // Long enough for a thread to have read itself, had it been asked to
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // Each read in with the rest, none on its own
    expect(threadReads).toEqual([])

    // The late reply under its comment
    await expect(threadOf(page, FIRST)).toContainText(LATE_REPLY)

    // The layout, named in the address
    await expect.poll(() => locationParam(page, POOL_VIEW_PARAM)).toBe('comments')

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
    const paperHeading = page.getByRole('link', { name: paperHeadingText(ELEMENTARY, DRAFT_BOARD) })

    // Followed
    await paperHeading.click()

    // The paper on its own page, on the discussion
    expect(await locationParam(page, OPEN_PAPER_PARAM)).toBe(ELEMENTARY.id)
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

  test('previews the statement of a problem a comment names by its number, and leaves a number no problem carries as text', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = rememberedSelection(null)

    // The elementary paper discussed, its comment naming problems by number
    memory.discussions.set(threadKey('SelectionPaper', ELEMENTARY.id), [
      postedComment('c-numbers', 'Martin', NUMBERED_REMARK, '2026-09-25T08:00:00.000Z'),
    ])

    // A selection whose paper is discussed so
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // The paper's thread
    const thread = page.getByRole('article').filter({ hasText: NUMBERED_REMARK })

    // The algebra problem's number in the comment, hovered
    await thread
      .getByRole('button', { name: `#${ALGEBRA.number}`, exact: true })
      .hover({ timeout: SETTLE_TIMEOUT_MS })

    // The algebra problem's statement
    await expect(page.getByRole('tooltip')).toContainText(`Part 1 of problem ${ALGEBRA.number}.`)

    // The number no problem carries, left as text
    await expect(thread.getByRole('button', { name: '#999' })).toHaveCount(0)
  })

  test('previews the statement of a problem a reply names by its number while the reply is still being written', async ({
    page,
  }) => {
    // A reader with a username, which a reply is signed with
    await stubNamedReader(page)

    // Whose selection's problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // The geometry problem's thread
    const thread = threadOf(page, GEOMETRY)

    // A reply, opened under the geometry problem's comment
    await thread
      .getByRole('button', { name: commentsCopy.reply })
      .click({ timeout: SETTLE_TIMEOUT_MS })

    // The reply, naming the algebra problem by number
    await page.getByPlaceholder(commentsCopy.replyPlaceholder).fill(NUMBERED_REPLY)

    // The reply's preview, up in place of its text
    await thread.getByRole('button', { name: editorCopy.preview, exact: true }).click()

    // The algebra problem's number in the preview, hovered
    await thread.getByRole('button', { name: `#${ALGEBRA.number}`, exact: true }).hover()

    // The algebra problem's statement
    await expect(page.getByRole('tooltip')).toContainText(`Part 1 of problem ${ALGEBRA.number}.`)
  })

  test('takes a layout picked straight after another, before the first one has been drawn', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // The discussions' option, as the page holds it
    const commentsOption = await poolView(page, selectionCopy.pool.views.comments).elementHandle()

    // The problems picked, and the discussions straight after, quicker than any hand could press
    await poolView(page, selectionCopy.pool.views.problems).evaluate(
      (problemsOption, laterOption) => {
        // The problems picked
        problemsOption.dispatchEvent(new MouseEvent('click', { bubbles: true }))

        // The discussions picked the moment the first press has run its course
        queueMicrotask(() => laterOption.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      },
      commentsOption
    )

    // The discussions, the last layout picked, named in the address
    await expect
      .poll(() => locationParam(page, POOL_VIEW_PARAM), { timeout: SETTLE_TIMEOUT_MS })
      .toBe('comments')

    // And laid out as the discussions
    await expect(poolView(page, selectionCopy.pool.views.comments)).toBeChecked()
    await expect(threadHeadings(page)).toHaveCount(4)
  })

  test('follows a jump through history to the layout its step holds, a problem open over the pool all the way', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool by the link on the problem's page, a new step in history
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The pool laid out as its problems
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The geometry problem, opened from its card
    await cardOf(page, GEOMETRY).getByRole('link', { name: GEOMETRY.title }).click()

    // The geometry problem's own page
    await expect(headingOf(page, GEOMETRY)).toBeVisible()

    // Two steps back in one go, from one problem straight to the other, whose step holds the discussions
    await page.evaluate(() => window.history.go(-2))

    // The first problem's page again
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The discussions, as the address holds them
    await expect(poolView(page, selectionCopy.pool.views.comments)).toBeChecked()
    await expect(threadHeadings(page)).toHaveCount(4)
    expect(await locationParam(page, POOL_VIEW_PARAM)).toBe('comments')
  })

  test('keeps its layout and search, and names both in the address, once the user menu opens the same selection', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // A reader on the selection's organization's list
    await stubOwnOrganizations(page, [MATHCOMPS])

    // The pool searched down to one problem by a link, the layout left to be picked
    await page.goto(`${SELECTION_PATH}?${new URLSearchParams({ q: READY.title })}`)

    // The pool's search box
    const search = searchBox(page)

    // Holding the search the link named
    await expect(search).toHaveValue(READY.title, { timeout: SETTLE_TIMEOUT_MS })

    // The pool laid out as its discussions
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // The search and the layout named in the address
    await expect
      .poll(() => locationParam(page, 'q'), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(READY.title)
    await expect.poll(() => locationParam(page, POOL_VIEW_PARAM)).toBe('comments')

    // How many steps history holds before the menu's link is taken
    const steps = await page.evaluate(() => window.history.length)

    // The user menu open
    await openUserMenu(page)

    // The same selection picked in it
    await page.getByRole('menuitem', { name: MATHCOMPS.name }).click()

    // The link taken, a new step in history
    await expect
      .poll(() => page.evaluate(() => window.history.length), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(steps + 1)

    // The search and the layout named in the address again
    await expect
      .poll(() => locationParam(page, 'q'), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(READY.title)
    await expect.poll(() => locationParam(page, POOL_VIEW_PARAM)).toBe('comments')

    // The pool still laid out as its discussions, searched down to a problem nobody has discussed
    await expect(poolView(page, selectionCopy.pool.views.comments)).toBeChecked()
    await expect(page.getByText(selectionCopy.pool.emptyCommentsFiltered)).toBeVisible()

    // Laid out as its problems again
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // Still searched down to the one problem
    await expect(search).toHaveValue(READY.title)
  })

  test('follows a step back to the layout its step holds, the selection reached from the user menu', async ({
    page,
  }) => {
    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', discussedSelection())

    // A reader on the selection's organization's list
    await stubOwnOrganizations(page, [MATHCOMPS])

    // A page other than the selection
    await page.goto(ABOUT_PATH)

    // The user menu open
    await openUserMenu(page)

    // The selection picked in it
    await page.getByRole('menuitem', { name: MATHCOMPS.name }).click()

    // The pool laid out as its discussions
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool by the link on the problem's page, a new step in history
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The pool laid out as its ratings
    await showPoolAs(page, selectionCopy.pool.views.ratings)

    // The ratings named in the address
    await expect.poll(() => locationParam(page, POOL_VIEW_PARAM)).toBe('ratings')

    // A step back, onto the problem opened over the discussions
    await page.goBack()

    // The first problem's page again
    await expect(headingOf(page, FIRST)).toBeVisible()

    // The discussions, as that step holds them
    await expect.poll(() => locationParam(page, POOL_VIEW_PARAM)).toBe('comments')

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Laid out as the discussions
    await expect(poolView(page, selectionCopy.pool.views.comments)).toBeChecked()
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

  test('takes what others edit at once, with nothing waiting behind a button', async ({ page }) => {
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

    // Martin's comment on the geometry problem, edited meanwhile, which gives it a new id
    memory.discussions.set(
      geometryKey,
      (memory.discussions.get(geometryKey) ?? []).map((posted) => ({
        ...posted,
        id: `${posted.id}-edited`,
        content: GEOMETRY_REMARK_EDITED,
        editedAt: '2026-10-03T08:00:00.000Z',
      }))
    )

    // The first problem, opened from its thread's heading
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // Back to the pool, which reads the discussions again
    await page.goBack()

    // Martin's comment as it reads now, marked as edited
    await expect(threadOf(page, GEOMETRY)).toContainText(GEOMETRY_REMARK_EDITED)
    await expect(threadOf(page, GEOMETRY)).toContainText(commentsCopy.edited)

    // What it said before, gone
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
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The gate, shut
    const release = gate.hold()

    // The pool laid out as its discussions again, their read held at the gate
    await showPoolAs(page, selectionCopy.pool.views.comments)

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

    // Everything the page announces to a screen reader, recorded from here on
    const announcements = await recordStatusAnnouncements(page)

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

    // The button there throughout, its notice said once, never falling silent to be heard again
    await expect(whatsNew).toBeVisible()
    expect(announcements().filter((text) => text === selectionCopy.pool.showWhatsNew)).toHaveLength(
      1
    )
  })

  test('shows what the backend took when one of two reactions pressed in a thread fails', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Zuzana's comment beside Martin's on the geometry problem
    addToGeometry(
      memory,
      postedComment('c-second', 'Zuzana', SECOND_REMARK, '2026-09-11T08:00:00.000Z')
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
      ...postedComment('c-own', 'Reader', OWN_REMARK, '2026-09-27T08:00:00.000Z'),
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
        paperHeadingText(ELEMENTARY, DRAFT_BOARD),
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
      page.getByRole('link', { name: paperHeadingText(ELEMENTARY, DRAFT_BOARD) })
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
        postedComment(
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
    expect(await locationParam(page, OPEN_PROPOSAL_PARAM)).toBe(GEOMETRY.id)
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
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The pool laid out as its discussions again
    await showPoolAs(page, selectionCopy.pool.views.comments)

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
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
    ])
  })
})

test.describe("the pool's discussions under its filters", () => {
  test("says nothing is discussed while the only thread is a set-aside problem's", async ({
    page,
  }) => {
    // The memory every selection test starts from
    const memory = rememberedSelection(null)

    // The memory's threads dropped, OPENED's among them
    memory.discussions.clear()

    // The set-aside problem's thread, the only one
    memory.discussions.set(threadKey('Proposal', SET_ASIDE.id), [
      postedComment('c-set-aside', 'Zuzana', SET_ASIDE_REMARK, '2026-09-15T08:00:00.000Z'),
    ])

    // A selection whose only discussed problem is set aside
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Nothing discussed in the live view, and no filter blamed, since no search or facet narrows it
    await expect(page.getByText(selectionCopy.pool.emptyComments)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })
  })

  test("narrows the threads by the pool's own search, carried over from the problems, shows a taken problem's and a finalized board's paper's threads with the rest, and the set-aside problem's alone under the set-aside pill, seen once it shows", async ({
    page,
  }) => {
    // A selection whose problems and papers are discussed, the set-aside problem's, the taken problem's and the
    // finalized board's paper's among them
    await stubSelection(page, 'selection', widelyDiscussed())

    // The pool
    await openPool(page)

    // The pool's search box
    const search = searchBox(page)

    // Searched down to a problem nobody has discussed
    await search.fill(READY.title)

    // The pool laid out as its discussions
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // The search still on, no thread about anything it finds, and the line over the pool counting no comment
    await expect(search).toHaveValue(READY.title)
    await expect(page.getByText(selectionCopy.pool.emptyCommentsFiltered)).toBeVisible()
    await expect(countLineOf(page, 0)).toBeVisible()

    // Once the reader's marks are read, every comment new on the pool's switch
    await expect(poolView(page, selectionCopy.pool.views.comments)).toHaveAccessibleName(
      `${selectionCopy.pool.views.comments} ${selectionText('pool.newCount', { count: 8 })}`
    )

    // The search cleared
    await search.fill('')

    // Every thread but the set-aside problem's, the taken problem's and the finalized board's paper's among them
    await expect(threadHeadings(page)).toHaveText(EVERY_LIVE_THREAD)

    // The line over the pool counting their comments, every one of them new
    await expect(countLineOf(page, 7)).toHaveText(lineText(7, 7))

    // The set-aside pill, counting the comment on the set-aside problem
    const setAside = page.getByRole('button', {
      name: selectionText('filters.setAside', { count: 1 }),
      exact: true,
    })

    // Switched on
    await setAside.click()

    // The set-aside problem's thread alone, its comment new
    await expect(threadHeadings(page)).toHaveText([headingText(SET_ASIDE)])
    await expect(countLineOf(page, 1)).toHaveText(lineText(1, 1))

    // The pool laid out as its problems again
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The set-aside problems still shown there
    await expect(cardOf(page, SET_ASIDE)).toBeVisible()

    // The pool laid out as its discussions once more
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // The set-aside problem's comment no longer new, the last visit having seen it once the pill showed it
    await expect(countLineOf(page, 1)).toHaveText(lineText(1, 0), { timeout: SETTLE_TIMEOUT_MS })
  })

  test('narrows by State, a whole paper offered on the discussions alone, which the problems read as no pick, and follows the board on screen, telling the backend what it shows', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = widelyDiscussed()

    // A selection whose problems and papers are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveText(EVERY_LIVE_THREAD, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The State pill, opened
    await page.getByRole('button', { name: selectionCopy.filters.state, exact: true }).click()

    // The first problem's two comments on the board, the opened, taken and geometry problems' three off it, and the
    // papers' two comments, each answer counting the comments it would show
    await expect(
      page.getByRole('radio', { name: `${selectionCopy.filters.selected} (2)`, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: `${selectionCopy.filters.notSelected} (3)`, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: `${selectionCopy.filters.wholePaper} (2)`, exact: true })
    ).toBeVisible()

    // The pill, closed again
    await page.keyboard.press('Escape')

    // The threads about a whole paper picked
    await pickPillAnswer(page, selectionCopy.filters.state, selectionCopy.filters.wholePaper)

    // The papers' threads, the finalized board's among them
    await expect(threadHeadings(page)).toHaveText([
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
      paperHeadingText(FINALIZED_PAPER, FINALIZED_BOARD),
    ])

    // The pool laid out as its problems
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // Every problem on offer, the State pill naming no pick and nothing to clear
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT)
    await expect(
      page.getByRole('button', { name: selectionCopy.filters.state, exact: true })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: facetsCopy.clearFilters })).toHaveCount(0)

    // The State pill, opened
    await page.getByRole('button', { name: selectionCopy.filters.state, exact: true }).click()

    // The pill open on its answers
    await expect(
      page.getByRole('radio', { name: new RegExp(`^${selectionCopy.filters.selected} \\(`) })
    ).toBeVisible()

    // No whole paper among them over the problems
    await expect(page.getByRole('radio', { name: selectionCopy.filters.wholePaper })).toHaveCount(0)

    // The pill, closed again
    await page.keyboard.press('Escape')

    // The pool laid out as its discussions again
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // The papers' threads still picked
    await expect(threadHeadings(page)).toHaveText([
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
      paperHeadingText(FINALIZED_PAPER, FINALIZED_BOARD),
    ])

    // The pool laid out as its problems once more
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // Narrowed there to what the board holds, in place of the whole paper
    await pickPillAnswer(page, selectionCopy.filters.state, selectionCopy.filters.selected)

    // The pool laid out as its discussions once more
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // The first problem's thread alone, the one discussed problem the board on screen holds
    await expect(threadHeadings(page)).toHaveText([headingText(FIRST)])

    // The later draft, which holds the geometry problem, put on screen
    await pickBoard(page, DRAFT_BOARD, LATER_DRAFT)

    // The geometry problem's thread in place of the first problem's
    await expect(threadHeadings(page)).toHaveText([headingText(GEOMETRY)])

    // The backend told the geometry problem was seen, now that the board on screen shows it
    await expect
      .poll(() => memory.seen.writes.at(-1))
      .toEqual({ proposals: { [GEOMETRY.id]: '2026-09-10T08:00:00.000Z' }, papers: {} })
  })

  test('narrows by Category, keeping the papers of a category picked, and by Area, which leaves every paper out, each option counting comments', async ({
    page,
  }) => {
    // A selection whose problems and papers are discussed
    await stubSelection(page, 'selection', widelyDiscussed())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn
    await expect(threadHeadings(page)).toHaveText(EVERY_LIVE_THREAD, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The Category pill, opened
    await page.getByRole('button', { name: selectionCopy.filters.category, exact: true }).click()

    // The elementary papers' two comments, the first, opened and taken problems' four for intermediate, and the
    // geometry problem's one for advanced
    await expect(
      page.getByRole('checkbox', { name: `${areaCopy.categories.elementary} (2)`, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: `${areaCopy.categories.intermediate} (4)`, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: `${areaCopy.categories.advanced} (1)`, exact: true })
    ).toBeVisible()

    // The pill, closed again
    await page.keyboard.press('Escape')

    // The elementary category picked
    await pickPillOption(
      page,
      selectionCopy.filters.category,
      `${areaCopy.categories.elementary} (2)`
    )

    // The elementary papers' threads, and the line counting their comments
    await expect(threadHeadings(page)).toHaveText([
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
      paperHeadingText(FINALIZED_PAPER, FINALIZED_BOARD),
    ])
    await expect(countLineOf(page, 2)).toBeVisible()

    // The Area pill, opened
    await page.getByRole('button', { name: selectionCopy.filters.area, exact: true }).click()

    // No comment counted for combinatorics under the papers' category, a paper belonging to no area
    await expect(
      page.getByRole('checkbox', { name: `${selectionCopy.areas.combinatorics} (0)`, exact: true })
    ).toBeVisible()

    // The pill, closed again
    await page.keyboard.press('Escape')

    // Every filter cleared
    await page.getByRole('button', { name: facetsCopy.clearFilters }).click()

    // Geometry picked
    await pickPillOption(page, selectionCopy.filters.area, `${selectionCopy.areas.geometry} (1)`)

    // The geometry problem's thread alone, the papers' left out
    await expect(threadHeadings(page)).toHaveText([headingText(GEOMETRY)])
  })

  test('tells the backend only the threads the filters show were seen, the rest new on the switch until a filter change shows them', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions, narrowed to geometry
    await page.goto(`${COMMENTS_ADDRESS}&area=geometry`)

    // The geometry problem's thread alone, its comment new
    await expect(countLineOf(page, 1)).toHaveText(lineText(1, 1), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told the geometry problem alone was seen
    await expect
      .poll(() => memory.seen.writes)
      .toEqual([{ proposals: { [GEOMETRY.id]: '2026-09-10T08:00:00.000Z' }, papers: {} }])

    // The way to the discussions on the pool's switch
    const commentsView = poolView(page, selectionCopy.pool.views.comments)

    // The four comments the filter hides still new on the switch
    await expect(commentsView).toHaveAccessibleName(
      `${selectionCopy.pool.views.comments} ${selectionText('pool.newCount', { count: 4 })}`
    )

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new in the thread shown
    await expect(countLineOf(page, 1)).toHaveText(lineText(1, 0))

    // The backend told the geometry problem alone again
    await expect.poll(() => memory.seen.writes.length).toBe(2)
    expect(memory.seen.writes.at(-1)).toEqual({
      proposals: { [GEOMETRY.id]: '2026-09-10T08:00:00.000Z' },
      papers: {},
    })

    // The filter cleared
    await page.getByRole('button', { name: facetsCopy.clearFilters }).click()

    // Every thread, the four comments they show afresh new through the visit
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 4))

    // The backend told what the threads show afresh was seen, the geometry problem left as it stood
    await expect.poll(() => memory.seen.writes.length).toBe(3)
    expect(memory.seen.writes.at(-1)).toEqual({
      proposals: {
        [FIRST.id]: '2026-10-01T08:00:00.000Z',
        [OPENED.id]: OPENED_COMMENT.createdAt,
      },
      papers: { [ELEMENTARY.id]: '2026-09-25T08:00:00.000Z' },
    })

    // Nothing new on the switch any more
    await expect(commentsView).toHaveAccessibleName(selectionCopy.pool.views.comments)
  })

  test('sees a problem only up to just before its oldest new comment in a thread the search hides, on the visit and on a search, then whole once that thread shows', async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Zuzana answering the geometry problem's comment on the second of October
    answerGeometry(memory)

    // Zuzana starting a second thread under the geometry problem on the third of October
    addToGeometry(
      memory,
      postedComment('c-second', 'Zuzana', SECOND_REMARK, '2026-10-03T08:00:00.000Z')
    )

    // Every discussion seen up to the mark, before both
    seeEverything(memory)

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions, searched down to the second thread
    await page.goto(`${COMMENTS_ADDRESS}&q=${encodeURIComponent('stand alone')}`)

    // The second thread alone, its comment new
    await expect(countLineOf(page, 1)).toHaveText(lineText(1, 1), { timeout: SETTLE_TIMEOUT_MS })

    // No eye beside the second thread, since a mark on the geometry problem would stop short of its comment
    await expect(page.getByRole('button', { name: selectionCopy.comments.markSeen })).toHaveCount(0)

    // The backend told the geometry problem was seen up to just before the hidden reply, which stays new
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals[GEOMETRY.id])
      .toBe('2026-10-02T07:59:59.999Z')

    // Searched down to the first problem's reply, which leaves the geometry problem out
    await searchBox(page).fill('should go into')

    // The backend told the first problem was seen, now that its thread shows
    await expect
      .poll(() => Object.keys(memory.seen.writes.at(-1)?.proposals ?? {}))
      .toEqual([FIRST.id])

    // Searched down to the second thread again
    await searchBox(page).fill('stand alone')

    // The backend told once more the geometry problem was seen only up to just before the hidden reply
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals)
      .toEqual({ [GEOMETRY.id]: '2026-10-02T07:59:59.999Z' })

    // The search cleared
    await searchBox(page).fill('')

    // The reply new beside the second thread's comment, as everything else posted since the mark
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([SECOND_REMARK, COLLEAGUE_REPLY, LATE_REPLY, OPENED_COMMENT.content])

    // The backend told the geometry problem was seen as a whole, now that both its threads show
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals[GEOMETRY.id])
      .toBe('2026-10-03T08:00:00.000Z')
  })

  test('tells the backend nothing a search shows only between two keys, typed over another', async ({
    page,
  }) => {
    // What the backend keeps, nothing in it ever seen
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions, searched down to the first problem by its number
    await page.goto(`${COMMENTS_ADDRESS}&q=${encodeURIComponent(`#${FIRST.number}`)}`)

    // The backend told the first problem alone was seen
    await expect
      .poll(() => memory.seen.writes.map((write) => Object.keys(write.proposals)), {
        timeout: SETTLE_TIMEOUT_MS,
      })
      .toEqual([[FIRST.id]])

    // The pool's search box
    const search = searchBox(page)

    // The first problem's number in the box, selected
    await search.selectText()

    // The geometry problem's number typed over the selection, key by key as a person types, through a lone # that
    // every problem's thread answers
    await search.pressSequentially(`#${GEOMETRY.number}`, { delay: 200 })

    // The backend told the geometry problem was seen once the search rested
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals)
      .toEqual({ [GEOMETRY.id]: '2026-09-10T08:00:00.000Z' })

    // Never the opened problem, which only the lone # showed
    expect(memory.seen.writes.flatMap((write) => Object.keys(write.proposals))).not.toContain(
      OPENED.id
    )
  })

  test('brings no button for a reply on a thread the filters hide, a button for one they show, and the hidden reply once a filter shows its thread', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions, narrowed to combinatorics, which leaves out the geometry problem and the paper
    await page.goto(`${COMMENTS_ADDRESS}&area=combinatorics`)

    // The first and the opened problem's threads
    await expect(threadHeadings(page)).toHaveText([headingText(FIRST), headingText(OPENED)], {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Everything the page announces to a screen reader, recorded from here on
    const announcements = await recordStatusAnnouncements(page)

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The first problem's page, reached from its thread's heading, reading its own thread alone, so the geometry
    // problem's thread is left to the pool's read
    await threadOf(page, FIRST).getByRole('link').first().click()

    // The first problem's own page
    await expect(headingOf(page, FIRST)).toBeVisible()

    // The discussions' read that going back sets off
    const readBack = page.waitForResponse(DISCUSSIONS_ADDRESS)

    // Back to the pool
    await page.goBack()

    // Once that read has landed
    await readBack

    // Long enough for a button to have come, had the read brought one
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // Never offered for the hidden reply
    expect(announcements()).not.toContain(selectionCopy.pool.showWhatsNew)
    await expect(whatsNew).toHaveCount(0)

    // Martin replying in the first problem's thread too
    replyIn(
      memory,
      FIRST,
      postedComment('c-newer', 'Martin', NEWER_REPLY, '2026-10-03T08:00:00.000Z')
    )

    // The opened problem's page, reached from its thread's heading, reading its own thread alone, so the first
    // problem's thread is left to the pool's read
    await threadOf(page, OPENED).getByRole('link').first().click()

    // The opened problem's own page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Back to the pool
    await page.goBack()

    // The button offered for the reply the filter shows
    await expect(whatsNew).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // How many times the backend was told something was seen, before the press
    const writesBefore = memory.seen.writes.length

    // What waits, shown
    await whatsNew.click()

    // The reply in, the button gone
    await expect(threadOf(page, FIRST)).toContainText(NEWER_REPLY)
    await expect(whatsNew).toHaveCount(0)

    // The backend told the threads shown were seen, nothing of the geometry problem's waiting reply or the paper's
    await expect.poll(() => memory.seen.writes.length).toBe(writesBefore + 1)
    expect(memory.seen.writes.at(-1)).toEqual({
      proposals: { [FIRST.id]: '2026-10-03T08:00:00.000Z', [OPENED.id]: OPENED_COMMENT.createdAt },
      papers: {},
    })

    // Geometry picked beside combinatorics, its one comment counted as the list last took it
    await pickPillOption(
      page,
      selectionCopy.areas.combinatorics,
      `${selectionCopy.areas.geometry} (1)`
    )

    // The geometry problem's thread among the rest, the reply that waited in it
    await expect(threadHeadings(page)).toHaveText([
      headingText(FIRST),
      headingText(GEOMETRY),
      headingText(OPENED),
    ])
    await expect(threadOf(page, GEOMETRY)).toContainText(COLLEAGUE_REPLY)

    // The button offered once in all, for Martin's reply, never for the one the filter hid
    expect(announcements().filter((text) => text === selectionCopy.pool.showWhatsNew)).toHaveLength(
      1
    )
  })

  test('brings the button for a new comment the search finds, and none for one it leaves out', async ({
    page,
  }) => {
    // What the backend keeps, which the test changes midway
    const memory = discussedSelection()

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool's discussions, searched down to the threads mentioning a paper
    await page.goto(`${COMMENTS_ADDRESS}&q=paper`)

    // The first and the opened problem's threads, and the paper's
    await expect(threadHeadings(page)).toHaveText(
      [headingText(FIRST), headingText(OPENED), paperHeadingText(ELEMENTARY, DRAFT_BOARD)],
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // Everything the page announces to a screen reader, recorded from here on
    const announcements = await recordStatusAnnouncements(page)

    // A new comment under the geometry problem the search leaves out
    addToGeometry(
      memory,
      postedComment('c-second', 'Zuzana', SECOND_REMARK, '2026-10-03T08:00:00.000Z')
    )

    // The opened problem's page, reached from its thread's heading, reading its own thread alone, so the geometry
    // problem's thread is left to the pool's read
    await threadOf(page, OPENED).getByRole('link').first().click()

    // The opened problem's own page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // The discussions' read that going back sets off
    const readBack = page.waitForResponse(DISCUSSIONS_ADDRESS)

    // Back to the pool
    await page.goBack()

    // Once that read has landed
    await readBack

    // Long enough for a button to have come, had the read brought one
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // Never offered for the comment the search leaves out
    expect(announcements()).not.toContain(selectionCopy.pool.showWhatsNew)
    await expect(whatsNew).toHaveCount(0)

    // A new comment under the geometry problem the search finds
    addToGeometry(
      memory,
      postedComment('c-third', 'Martin', PAPER_MENTIONING_REMARK, '2026-10-04T08:00:00.000Z')
    )

    // The opened problem, opened again from its thread's heading
    await threadOf(page, OPENED).getByRole('link').first().click()

    // The opened problem's own page
    await expect(headingOf(page, OPENED)).toBeVisible()

    // Back to the pool
    await page.goBack()

    // The button offered
    await expect(whatsNew).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // What waits, shown
    await whatsNew.click()

    // The new comment's thread on top, the geometry problem's other threads still left out
    await expect(threadHeadings(page)).toHaveText([
      headingText(GEOMETRY),
      headingText(FIRST),
      headingText(OPENED),
      paperHeadingText(ELEMENTARY, DRAFT_BOARD),
    ])
    await expect(threadOf(page, GEOMETRY)).toContainText(PAPER_MENTIONING_REMARK)

    // The backend told the geometry problem was seen only up to just before its oldest comment the search leaves out
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals[GEOMETRY.id])
      .toBe('2026-09-10T07:59:59.999Z')

    // The button offered once in all, for the comment the search found
    expect(announcements().filter((text) => text === selectionCopy.pool.showWhatsNew)).toHaveLength(
      1
    )
  })
})

test.describe("what is new in the pool's discussions", () => {
  test('keeps a thread whose problem somebody sets aside where it stood until what waits is shown', async ({
    page,
  }) => {
    // The clock under the test's hand, so the next read comes when the test says
    await page.clock.install()

    // A selection whose problems and paper are discussed
    const answerSelectionWith = await stubSelection(page, 'selection', discussedSelection())

    // The pool's discussions
    await page.goto(COMMENTS_ADDRESS)

    // Once every thread is drawn, the first problem's among them
    await expect(threadHeadings(page)).toHaveCount(4, { timeout: SETTLE_TIMEOUT_MS })

    // The threads as they stand, top to bottom
    const headingsBefore = await threadHeadings(page).allTextContents()

    // A later read, in which another reviewer has set the first problem aside
    answerSelectionWith('later')

    // Long enough for the selection to be read again
    await page.clock.fastForward('00:31')

    // The button showing what waits
    const whatsNew = page.getByRole('button', { name: selectionCopy.pool.showWhatsNew })

    // Offered once the read has landed
    await expect(whatsNew).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Every thread still where it stood, the first problem's among them
    await expect(threadHeadings(page)).toHaveText(headingsBefore)

    // What waits, shown
    await whatsNew.click()

    // The first problem's thread gone, now that the problem is set aside
    await expect(threadHeadings(page)).toHaveCount(3)
    await expect(threadOf(page, FIRST)).toHaveCount(0)
  })

  test("marks every comment somebody else posted as new where nothing was seen, never the reader's own, and tells the backend each discussion was seen up to the newest of them", async ({
    page,
  }) => {
    // What the backend keeps, none of it ever seen
    const memory = discussedSelection()

    // The reader's own remark in the geometry problem's discussion
    addToGeometry(memory, {
      ...postedComment('c-own', 'Reader', OWN_REMARK, '2026-09-27T08:00:00.000Z'),
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
    await expect
      .poll(async () => (await newCommentTexts(page, MARKABLE_TEXTS)).toSorted())
      .toEqual(
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
        ...postedComment('c-geometry', 'Martin', GEOMETRY_REMARK, '2026-09-10T08:00:00.000Z'),
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
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([LATE_REPLY, OPENED_COMMENT.content])
  })

  test('keeps what was new through the visit, tells the backend what waited behind the button was seen only once it shows, and drops it all next visit', async ({
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
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([LATE_REPLY, OPENED_COMMENT.content])

    // Long enough for a mark to have gone out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // No mark told the backend the waiting reply was seen
    expect(memory.seen.writes.map((write) => write.proposals[GEOMETRY.id])).not.toContain(
      '2026-10-02T08:00:00.000Z'
    )

    // What waited, shown
    await whatsNew.click()

    // The reply new too, its thread first
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([COLLEAGUE_REPLY, LATE_REPLY, OPENED_COMMENT.content])

    // The backend told the geometry problem was seen up to the reply, now that it shows
    await expect
      .poll(() => memory.seen.writes.at(-1)?.proposals[GEOMETRY.id])
      .toBe('2026-10-02T08:00:00.000Z')

    // Long enough for the backend's answer to have landed
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // The three new comments still new, for the rest of the visit
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 3))

    // The pool laid out as its problems
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The pool laid out as its discussions again
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // Nothing new any more, the reply shown during the last visit included
    await expect(countLineOf(page, 6)).toHaveText(lineText(6, 0), { timeout: SETTLE_TIMEOUT_MS })
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
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // Zuzana answering the geometry problem's comment meanwhile
    answerGeometry(memory)

    // The gate, shut
    const release = gate.hold()

    // The pool laid out as its discussions again, their read held at the gate
    await showPoolAs(page, selectionCopy.pool.views.comments)

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
    await expect.poll(() => newCommentTexts(page, MARKABLE_TEXTS)).toEqual([COLLEAGUE_REPLY])
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
    await showPoolAs(page, selectionCopy.pool.views.problems)

    // The pool laid out as its discussions again
    await showPoolAs(page, selectionCopy.pool.views.comments)

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
    await showPoolAs(page, selectionCopy.pool.views.comments)

    // Every comment new
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5), { timeout: SETTLE_TIMEOUT_MS })

    // The backend told what the tab shows was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new, the eye gone and the focus on the line
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 0))
    expect(await newCommentTexts(page, MARKABLE_TEXTS)).toEqual([])
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
    await showPoolAs(page, selectionCopy.pool.views.problems)

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
    replyIn(
      memory,
      FIRST,
      postedComment('c-newer', 'Martin', NEWER_REPLY, '2026-10-03T08:00:00.000Z')
    )

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
    await expect.poll(() => newCommentTexts(page, MARKABLE_TEXTS)).toEqual([COLLEAGUE_REPLY])
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
    await expect
      .poll(() => newCommentTexts(panel, MARKABLE_TEXTS))
      .toEqual([FIRST_REMARK, LATE_REPLY])

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new in it any more
    await expect.poll(() => newCommentTexts(panel, MARKABLE_TEXTS)).toEqual([])

    // Back to the pool
    await page.goBack()

    // The problem's thread not new there either
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 3), { timeout: SETTLE_TIMEOUT_MS })
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([OPENED_COMMENT.content, PAPER_REMARK, GEOMETRY_REMARK])
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
    await page.getByRole('link', { name: paperHeadingText(ELEMENTARY, DRAFT_BOARD) }).click()

    // The paper's problems
    await page.getByRole('tab', { name: selectionCopy.paper.problemsTab }).click()

    // The first problem's comment count plain on its card among them
    await expect(tabRowOn(cardOf(page, FIRST), 'comments', 2)).toBeVisible()

    // Back to the pool
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // Every comment still new in the pool
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 5))
  })

  test("counts on the pool's Comments option what is new across the discussions, until a visit tells the backend it was seen", async ({
    page,
  }) => {
    // What the backend keeps
    const memory = discussedSelection()

    // Every discussion seen up to the mark, the reply in the first problem's thread and the opened problem's comment
    // posted since
    seeEverything(memory)

    // A selection whose problems and paper are discussed
    await stubSelection(page, 'selection', memory)

    // The pool, laid out as its problems
    await openPool(page)

    // The way to the discussions on the pool's switch
    const commentsView = poolView(page, selectionCopy.pool.views.comments)

    // Both new comments on it, as a screen reader says them
    await expect(commentsView).toHaveAccessibleName(
      `${selectionCopy.pool.views.comments} ${selectionText('pool.newCount', { count: 2 })}`,
      { timeout: SETTLE_TIMEOUT_MS }
    )

    // Both new comments on it, as the number beside the name
    await expect(commentsView.locator('[aria-hidden="true"]')).toHaveText('2')

    // The discussions
    await commentsView.click()

    // The backend told what they show was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // Nothing counted on the switch any more
    await expect(commentsView).toHaveAccessibleName(selectionCopy.pool.views.comments)

    // Both comments still new in the discussions
    await expect(countLineOf(page, 5)).toHaveText(lineText(5, 2))
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
      .poll(() => newCommentTexts(panel, MARKABLE_TEXTS), { timeout: SETTLE_TIMEOUT_MS })
      .toEqual([PAPER_REMARK])

    // The backend told the paper's discussion was seen
    await expect.poll(() => memory.seen.writes.length).toBe(1)

    // The eye pressed
    await page.getByRole('button', { name: selectionCopy.comments.markSeen }).click()

    // Nothing new in it any more
    await expect.poll(() => newCommentTexts(panel, MARKABLE_TEXTS)).toEqual([])

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
    await expect
      .poll(() => newCommentTexts(page, MARKABLE_TEXTS))
      .toEqual([OPENED_COMMENT.content, PAPER_REMARK, GEOMETRY_REMARK])
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
    await showPoolAs(page, selectionCopy.pool.views.comments)

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
