import type { Page } from '@playwright/test'

import type { UserProfile } from '@/components/features/profile/model/profile-types'
import { MATHILDA_NAME } from '@/constants/mathilda'

import messages from '../messages/en.json'
import { type AnswerGate, gateReads } from './support/answer-gate'
import { answerJson, BACKEND_ORIGIN } from './support/backend-routes'
import {
  actionsCopy,
  chatCopy,
  closeChat,
  SELECTION_PATH,
  sendTurn,
  transcriptOf,
} from './support/competitions'
import { installHostedBackend, SESSION_LIST_ADDRESS } from './support/hosted-backend'
import { SCRIPTED_REPLIES } from './support/hosted-backend-content'
import {
  ARGUED,
  ARGUED_EARLIER,
  BILINGUAL,
  cardOf,
  CONVERSATION_ENDPOINT,
  EARLIER,
  EARLIER_STATEMENT,
  headingOf,
  LANDING_WINDOW_MS,
  ON_OFFER_COUNT,
  OPENED,
  OPENED_ADDRESS,
  OPENED_COMMENT,
  READER_NAME,
  RECENT,
  rememberedSelection,
  REVIEWER,
  REVISION,
  selectionCopy,
  selectionText,
  SETTLE_TIMEOUT_MS,
  stubSelection,
} from './support/problem-selection'
import { expect, test } from './support/test'

/** What a reviewer writes into {@link OPENED}'s discussion while a test watches. */
const NEW_COMMENT = 'Too long for the elementary paper as it stands.'

/**
 * The rows of the conversations listed under a problem, one per conversation.
 *
 * @param page - The page.
 *
 * @returns The rows.
 */
function conversationRows(page: Page) {
  // The buttons in the panel showing, each opening one conversation
  return page.getByRole('tabpanel').getByRole('button')
}

/**
 * Opens Mathilda on {@link BILINGUAL}, which nobody has talked to her about yet, and waits until the chat has
 * read that.
 *
 * @param page - The page.
 *
 * @returns The gate in front of every later read of the problem's conversations, open until the test holds it.
 */
async function openMathildaOnBilingual(page: Page): Promise<AnswerGate> {
  // The backend the chat talks to, which keeps what is said to Mathilda
  const chat = await installHostedBackend(page, 'ready')

  // A reviewer whose selection holds a pool of problems
  await stubSelection(page, 'selection', rememberedSelection(chat))

  // What every read of a problem's conversations waits at
  const history = await gateReads(page, SESSION_LIST_ADDRESS)

  // The problem, solved in English
  await page.goto(`${SELECTION_PATH}?problem=${BILINGUAL.id}`)

  // The read the chat opens with
  const firstRead = page.waitForResponse(SESSION_LIST_ADDRESS)

  // A conversation with her, opened
  await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

  // Once it has found none held yet
  await firstRead

  // The gate, for the test to hold
  return history
}

test.describe('what reviewers said about a problem', () => {
  test('counts the conversations and comments on each card, the comment count opening its tab', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems, one of them argued and discussed
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The conversations held with Mathilda about a problem, counted on its card
    await expect(
      cardOf(page, OPENED).getByRole('link', {
        name: selectionText('filing.conversations', { count: 2 }),
      })
    ).toBeVisible()

    // The card's count of the comments under it
    const commentCount = cardOf(page, OPENED).getByRole('link', {
      name: selectionText('filing.comments', { count: 1 }),
    })

    // Shown too
    await expect(commentCount).toBeVisible()

    // A problem nobody has said anything about links to its own page alone
    await expect(cardOf(page, BILINGUAL).getByRole('link')).toHaveCount(1)

    // The comment count, followed
    await commentCount.click()

    // Onto the problem's discussion, named in the address
    await expect(page).toHaveURL(`${OPENED_ADDRESS}&tab=comments`)

    // Its tab, the one selected
    await expect(page.getByRole('tab', { selected: true })).toContainText(
      selectionCopy.detail.commentsTab
    )

    // With what was said in it
    await expect(page.getByRole('tabpanel')).toContainText(OPENED_COMMENT.content)
  })

  test('opens a problem on its conversations, and names a tab picked in the address without a step of its own', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // The pool
    await page.goto(SELECTION_PATH)

    // Once every card is drawn
    await expect(page.getByRole('article')).toHaveCount(ON_OFFER_COUNT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A problem, opened by its name
    await cardOf(page, OPENED).getByRole('link', { name: OPENED.title }).click()

    // On its conversations
    await expect(page.getByRole('tab', { selected: true })).toContainText(
      selectionCopy.detail.conversationsTab
    )

    // Its discussion, picked
    await page.getByRole('tab', { name: selectionCopy.detail.commentsTab }).click()

    // Named in the address, so a link copied now opens on it
    await expect(page).toHaveURL(`${OPENED_ADDRESS}&tab=comments`)

    // Back
    await page.goBack()

    // Onto the pool, the tab having taken no step in history of its own
    await expect(page).toHaveURL(SELECTION_PATH)

    // Forward
    await page.goForward()

    // Onto the problem's discussion again
    await expect(page.getByRole('tab', { selected: true })).toContainText(
      selectionCopy.detail.commentsTab
    )
  })

  test('opens a link naming a tab the page does not have on the conversations', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems
    await stubSelection(page, 'selection')

    // A link naming a tab the page does not have
    await page.goto(`${OPENED_ADDRESS}&tab=history`)

    // Opened on the conversations
    await expect(page.getByRole('tab', { selected: true })).toContainText(
      selectionCopy.detail.conversationsTab,
      { timeout: SETTLE_TIMEOUT_MS }
    )
  })

  test('lists every conversation newest first, and reads what was said in one only once it is opened', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems, one of them argued twice
    await stubSelection(page, 'selection')

    // How many conversations have been read in full
    let reads = 0

    // Every read of a conversation, counted as it goes out
    page.on('request', (request) => {
      // One more, if it reads a conversation
      if (request.url().startsWith(CONVERSATION_ENDPOINT)) reads++
    })

    // The problem argued twice
    await page.goto(OPENED_ADDRESS)

    // The conversation rows
    const rows = conversationRows(page)

    // One per conversation
    await expect(rows).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS })

    // The most recent first, held by the reviewer
    await expect(rows.nth(0)).toContainText(REVIEWER)

    // With how much was said in it
    await expect(rows.nth(0)).toContainText(
      selectionText('conversations.messages', { count: RECENT.transcript.turns.length })
    )

    // The earlier one after it, held by a reviewer with no username
    await expect(rows.nth(1)).toContainText(messages.profile.defaultUser)

    // With how much was said in it
    await expect(rows.nth(1)).toContainText(
      selectionText('conversations.messages', { count: EARLIER.transcript.turns.length })
    )

    // Time for a read the list set off to go out
    await page.waitForTimeout(LANDING_WINDOW_MS)

    // None did, nothing said in either having been asked for
    expect(reads).toBe(0)

    // The most recent one, opened
    await rows.nth(0).click()

    // Named by who talked
    await expect(
      page.getByRole('dialog').getByRole('heading', {
        name: selectionText('conversations.participants', { author: REVIEWER }),
      })
    ).toBeVisible()

    // With what was said
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // Under the statement it was argued against
    await expect(page.getByRole('dialog')).toContainText(`Part 1 of problem ${OPENED.number}.`)

    // Unmarked, that statement being the one the problem has now
    await expect(page.getByRole('dialog')).not.toContainText(chatCopy.editedSince)

    // Read once, as it opened
    expect(reads).toBe(1)
  })

  test('marks a conversation argued against a statement since revised, and shows it under that statement', async ({
    page,
  }) => {
    // A reviewer whose selection holds a pool of problems, one of them argued before and after a revision
    await stubSelection(page, 'selection')

    // The problem
    await page.goto(OPENED_ADDRESS)

    // The conversation rows
    const rows = conversationRows(page)

    // One per conversation
    await expect(rows).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS })

    // The one argued against the statement the problem has now, unmarked
    await expect(rows.nth(0)).not.toContainText(selectionCopy.conversations.olderStatement)

    // The one argued against the statement as it stood before, marked
    await expect(rows.nth(1)).toContainText(selectionCopy.conversations.olderStatement)

    // Opened
    await rows.nth(1).click()

    // Saying the problem has changed since
    await expect(page.getByRole('dialog')).toContainText(chatCopy.editedSince)

    // Under the statement as it stood then
    await expect(page.getByRole('dialog')).toContainText(EARLIER_STATEMENT, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // With what was said against it
    await expect(transcriptOf(page)).toContainText(ARGUED_EARLIER)
  })

  test('says so when a conversation on the list can no longer be read', async ({ page }) => {
    // What the backend keeps, which the test changes midway
    const memory = rememberedSelection(null)

    // A reviewer whose selection holds a pool of problems, one of them argued twice
    await stubSelection(page, 'selection', memory)

    // The problem
    await page.goto(OPENED_ADDRESS)

    // The conversation rows
    const rows = conversationRows(page)

    // One per conversation
    await expect(rows).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS })

    // The most recent one, dropped by the reviewer who held it after the list was read
    memory.conversations = memory.conversations.filter((conversation) => conversation !== RECENT)

    // Opened from the list still showing it
    await rows.nth(0).click()

    // Said it could not be loaded
    await expect(page.getByRole('dialog')).toContainText(
      selectionCopy.conversations.transcriptFailed,
      { timeout: SETTLE_TIMEOUT_MS }
    )
  })

  test('offers Mathilda only on a problem with a solution, and lists a conversation held with her', async ({
    page,
  }) => {
    // The backend the chat talks to, which keeps what is said to Mathilda
    const chat = await installHostedBackend(page, 'ready')

    // A reviewer whose selection holds a pool of problems, and lists the conversations held through the chat
    await stubSelection(page, 'selection', rememberedSelection(chat))

    // A problem solved in no language
    await page.goto(OPENED_ADDRESS)

    // Its page
    await expect(headingOf(page, OPENED)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // Offering no conversation, Mathilda having no solution to reason from
    await expect(page.getByRole('button', { name: MATHILDA_NAME, exact: true })).toHaveCount(0)

    // A problem solved in English, which the site is read in
    await page.goto(`${SELECTION_PATH}?problem=${BILINGUAL.id}`)

    // Nobody having talked to her about it yet
    await expect(page.getByRole('tabpanel')).toContainText(selectionCopy.conversations.empty, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A conversation with her, opened
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Her reply
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed
    await page.keyboard.press('Escape')

    // The conversation listed under the problem
    await expect(conversationRows(page)).toHaveCount(1)

    // Her greeting, the argument and her reply in it
    await expect(conversationRows(page)).toContainText(
      selectionText('conversations.messages', { count: 3 })
    )
  })

  test('continues a conversation with Mathilda under the statement it was argued against, saying the problem has been revised since', async ({
    page,
  }) => {
    // The backend the chat talks to, which keeps what is said to Mathilda
    const chat = await installHostedBackend(page, 'ready')

    // A reviewer whose selection holds a pool of problems, read again as the test says
    const answerSelectionWith = await stubSelection(page, 'selection', rememberedSelection(chat))

    // A problem solved in English, which the site is read in
    await page.goto(`${SELECTION_PATH}?problem=${BILINGUAL.id}`)

    // Its page
    await expect(headingOf(page, BILINGUAL)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })

    // The button opening a conversation with Mathilda
    const mathilda = page.getByRole('button', { name: MATHILDA_NAME, exact: true })

    // A conversation with her, opened
    await mathilda.click()

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Her reply
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The problem read again, once the conversation has been saved
    await page.reload()

    // The chat, opened again
    await mathilda.click()

    // On the conversation, continued
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // Saying nothing changed, its statement being the one the problem has
    await expect(page.getByRole('dialog')).not.toContainText(chatCopy.editedSince)

    // The problem's author revising its English statement meanwhile
    answerSelectionWith('revisedInEnglish')

    // The problem read again
    await page.reload()

    // In its revised statement
    await expect(page.getByRole('article').getByText(REVISION)).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, opened again
    await mathilda.click()

    // On the conversation, continued
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // Saying the problem has been revised since
    await expect(page.getByRole('dialog')).toContainText(chatCopy.editedSince)

    // Under the statement Mathilda argues, which the revision is not part of
    await expect(page.getByRole('dialog')).not.toContainText(REVISION)

    // A fresh conversation, started beside it
    await page.getByRole('button', { name: chatCopy.newDefense }).click()

    // Under the statement as revised
    await expect(page.getByRole('dialog')).toContainText(REVISION)

    // Unmarked, its statement being the one the problem has now
    await expect(page.getByRole('dialog')).not.toContainText(chatCopy.editedSince)
  })

  test('opens again on the conversation just held, closed before the list of them was read again', async ({
    page,
  }) => {
    // A conversation with Mathilda about a problem nobody has talked to her about yet
    const history = await openMathildaOnBilingual(page)

    // Every read from here on held, so the one her reply sets off is still in flight when the chat closes
    const release = history.hold()

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Her reply
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Still taking arguments while the list of conversations is read again behind it
    await expect(page.locator('textarea')).toBeVisible()

    // The chat, closed straight away
    await closeChat(page)

    // And opened again
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // Taking no argument while it cannot yet tell which conversation it is carrying on
    await expect(page.getByRole('dialog')).toContainText(chatCopy.libraryLoading)
    await expect(page.locator('textarea')).toHaveCount(0)

    // The list of conversations read at last
    release()

    // Carrying on the one just held
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // And taking the next argument
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('opens again on the newer of two conversations, the second closed before the list was read again', async ({
    page,
  }) => {
    // A conversation with Mathilda about a problem nobody has talked to her about yet
    const history = await openMathildaOnBilingual(page)

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Saved, and listed among the problem's conversations once the list has been read again
    await expect(page.getByRole('button', { name: chatCopy.history })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A second conversation beside it
    await page.getByRole('button', { name: chatCopy.newDefense }).click()

    // Every read from here on held, so the one the second reply sets off is still in flight when the chat closes
    const release = history.hold()

    // What the second one argues
    const secondArgument = 'Pairing the numbers up leaves the second player a reply to every move.'

    // Put to her
    await sendTurn(page, secondArgument)

    // And answered
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed straight away
    await closeChat(page)

    // And opened again
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // The list of conversations read at last
    release()

    // Carrying on the second conversation
    await expect(transcriptOf(page)).toContainText(secondArgument, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('opens again on the conversation in hand when the list of them cannot be read again', async ({
    page,
  }) => {
    // A clock the spec can walk forward, so the list read with the conversation can grow old
    await page.clock.install()

    // A conversation with Mathilda about a problem nobody has talked to her about yet
    await openMathildaOnBilingual(page)

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Saved, and listed among the problem's conversations once the list has been read again
    await expect(page.getByRole('button', { name: chatCopy.history })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed
    await closeChat(page)

    // Registered after the backend standing in behind it, which is what puts this one first
    await page.route(SESSION_LIST_ADDRESS, async (route) => {
      // An aborted connection is what a student sees when nothing is there to answer them
      await route.abort('connectionrefused')
    })

    // Long enough for the list in hand to count as old, so opening the chat reads it again
    await page.clock.fastForward('01:00')

    // And opened again
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // On the conversation the list in hand holds, the new read never getting through
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('says so when the list a reopened chat waits on cannot be read, and opens on the conversation once it can', async ({
    page,
  }) => {
    // A conversation with Mathilda about a problem nobody has talked to her about yet
    const history = await openMathildaOnBilingual(page)

    // Every read from here on held, so the one her reply sets off is still in flight when the chat closes
    const release = history.hold()

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Her reply
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed straight away
    await closeChat(page)

    // The gate let go, leaving the outage below as what every later read meets
    release()

    // Whether the list can be read, which it cannot until the test says so
    let isListReachable = false

    // Registered after the gate in front of the backend, which is what puts this one first
    await page.route(SESSION_LIST_ADDRESS, async (route) => {
      // Once reachable, on to the backend behind this
      if (isListReachable) {
        await route.fallback()
        return
      }

      // An aborted connection is what a student sees when nothing is there to answer them
      await route.abort('connectionrefused')
    })

    // The chat, opened again
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // Saying so once the read gives up
    await expect(page.getByRole('dialog')).toContainText(chatCopy.conversationUnavailable, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The list reachable again
    isListReachable = true

    // And asked for again
    await page.getByRole('dialog').getByRole('button', { name: actionsCopy.retry }).click()

    // Carrying on the one just held
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })
  })

  test('opens again straight on the conversation just held, once the list of them has been read again', async ({
    page,
  }) => {
    // A conversation with Mathilda about a problem nobody has talked to her about yet
    await openMathildaOnBilingual(page)

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Saved, and listed among the problem's conversations once the list has been read again
    await expect(page.getByRole('button', { name: chatCopy.history })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed
    await closeChat(page)

    // And opened again, on the list in hand, which already holds it
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // Carrying on the one just held
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // And taking the next argument
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('waits for the connection before opening on a list known to miss the conversation just held', async ({
    page,
  }) => {
    // A conversation with Mathilda about a problem nobody has talked to her about yet
    const history = await openMathildaOnBilingual(page)

    // Every read from here on held, so the one her reply sets off is still in flight when the chat closes
    const release = history.hold()

    // An argument put to her
    await sendTurn(page, ARGUED)

    // Her reply
    await expect(transcriptOf(page)).toContainText(SCRIPTED_REPLIES[0]!, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // The chat, closed straight away
    await closeChat(page)

    // Every later read let through the gate
    release()

    // The connection lost, which is what holds the next read back now
    await page.context().setOffline(true)

    // The chat, opened again
    await page.getByRole('button', { name: MATHILDA_NAME, exact: true }).click()

    // Taking no argument while it cannot yet tell which conversation it is carrying on
    await expect(page.getByRole('dialog')).toContainText(chatCopy.libraryLoading)
    await expect(page.locator('textarea')).toHaveCount(0)

    // The connection back
    await page.context().setOffline(false)

    // Carrying on the one just held
    await expect(transcriptOf(page)).toContainText(ARGUED, { timeout: SETTLE_TIMEOUT_MS })

    // And taking the next argument
    await expect(page.locator('textarea')).toBeVisible()
  })

  test("writes a comment into a problem's discussion, and counts it on the problem's card", async ({
    page,
  }) => {
    // A reviewer with a username, which the discussion asks for before it takes a comment
    await page.route(`${BACKEND_ORIGIN}/users/me/profile`, (route) =>
      answerJson(route, 200, {
        graduationYear: null,
        hasLeftHighSchool: true,
        countryCode: null,
        email: null,
        username: READER_NAME,
      } satisfies UserProfile)
    )

    // Whose selection holds a pool of problems, one of them discussed
    await stubSelection(page, 'selection')

    // The problem's discussion
    await page.goto(`${OPENED_ADDRESS}&tab=comments`)

    // With what was said in it so far
    await expect(page.getByRole('tabpanel')).toContainText(OPENED_COMMENT.content, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // A comment, written
    await page.getByRole('tabpanel').locator('textarea').fill(NEW_COMMENT)

    // And sent from the keyboard
    await page.keyboard.press('Meta+Enter')

    // In the discussion
    await expect(page.getByRole('tabpanel')).toContainText(NEW_COMMENT)

    // Back to the pool by the link on the problem's page
    await page.getByRole('link', { name: selectionCopy.detail.backToPool }).click()

    // The problem's card counting it
    await expect(
      cardOf(page, OPENED).getByRole('link', {
        name: selectionText('filing.comments', { count: 2 }),
      })
    ).toBeVisible()
  })
})
