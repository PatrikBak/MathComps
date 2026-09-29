import type { Locator } from '@playwright/test'

import type {
  AdminConversation,
  DefenseTurnAttempt,
} from '@/components/features/admin/conversation/model/admin-conversation'
import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import type {
  NamedDefenseTarget,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'

import messages from '../../messages/en.json'
import { expect } from './test'

/**
 * The parts of a conversation chosen by the caller building it.
 */
type ConversationOpening = {
  /** Stable identifier. */
  id: string
  /** Who held it. */
  user: UserIdentity
  /** The problem it was held against. */
  target: NamedDefenseTarget
  /** The problem statement. */
  statement: string
  /** The reference solution. */
  reference: string
  /** The student's first answer. */
  answer: string
  /** When it was started, as an ISO-8601 string. */
  startedAt: string
}

/** How long each draft behind Mathilda's reply took, in the order they were made. */
const DRAFT_DURATIONS_MS = [4000, 5200]

/** How long the student took over their follow-up, from the reply landing to it arriving. */
const FOLLOW_UP_MS = 108_300

/** The draft the leak check sent back. */
const LEAKY_DRAFT = 'Halving both sides gives x = 2 at once.'

/** The reply that went out. */
const REPLY = 'Why does halving keep every solution?'

/** How many turns a partly read conversation holds, enough that neither the read half nor the rest fits on screen. */
const PARTLY_READ_TURNS = 40

/** How far apart the turns of a partly read conversation were said, in milliseconds. */
const PARTLY_READ_SPACING_MS = 60_000

/** What each turn of a partly read conversation says after its number, long enough to fill a few lines. */
const PARTLY_READ_FILLER =
  'Every step of the argument is written out here in full, ' +
  'so that the turn takes up a few lines of the conversation.'

/** What the first turn past a partly read conversation's read stamp opens with. */
export const FIRST_UNREAD_TURN_TEXT = `Turn ${PARTLY_READ_TURNS / 2 + 1}.`

/** What the student made of the conversation as a whole. */
const VERDICT_COMMENT = 'Fair questions.'

/** What the student held against the reply. */
const REPORT_COMMENT = 'She all but told me.'

/**
 * Builds one draft behind the reply, with the one call that wrote it.
 *
 * @param turnId - The reply it was drafted for.
 * @param attemptIndex - Its place in the reply's run.
 * @param reply - The drafted text.
 * @param durationMs - How long it took.
 *
 * @returns The draft, clean but for a leak on every draft the leak check sent back.
 */
function draftOf(
  turnId: string,
  attemptIndex: number,
  reply: string,
  durationMs: number
): DefenseTurnAttempt {
  // Every draft before the last one was sent back for giving something away
  const leaks = attemptIndex < DRAFT_DURATIONS_MS.length - 1

  // The draft and every verdict on it
  return {
    turnId,
    attemptIndex,
    reply,
    revisionNote: attemptIndex === 0 ? '' : 'You gave away the halving.',
    mathHolds: true,
    mathCorrection: '',
    leaks,
    whatLeaked: leaks ? 'the halving' : '',
    withholdsClose: false,
    established: '',
    switchesLanguage: false,
    candidateLanguage: 'English',
    gendersTheReader: false,
    takesOver: false,
    candidateWork: '',
    restatedReferenceStep: '',
    isSafeFallback: false,
    calls: [
      {
        step: 'generate',
        model: 'fake/model',
        reasoningEffort: null,
        cost: 0.001,
        promptTokens: 100,
        completionTokens: 20,
        reasoningTokens: 0,
        durationMs,
      },
    ],
    durationMs,
  }
}

/**
 * Builds a conversation with everything the student and Mathilda put into one: her opener and the student's
 * answer, her reply after a draft the leak check sent back, the student's follow-up, what they reported on the
 * reply, and their verdict on the whole.
 *
 * @param opening - The parts the caller chooses.
 *
 * @returns The conversation.
 */
export function wholeConversationOf(opening: ConversationOpening): AdminConversation {
  // When it was started, in milliseconds
  const startedAtMs = Date.parse(opening.startedAt)

  // The reply lands once its drafts have run one after another
  const replyAtMs =
    startedAtMs + DRAFT_DURATIONS_MS.reduce((total, durationMs) => total + durationMs, 0)

  // The reply the drafts and the report stand against
  const replyId = `${opening.id}-reply`

  // The conversation, its opener and first answer stamped together as a start saves them, nothing yet read or
  // written about it
  return {
    id: opening.id,
    target: opening.target,
    user: opening.user,
    createdAt: opening.startedAt,
    statement: opening.statement,
    reference: opening.reference,
    turns: [
      {
        id: `${opening.id}-opener`,
        role: 'examiner',
        content: 'Walk me through it.',
        createdAt: opening.startedAt,
      },
      {
        id: `${opening.id}-answer`,
        role: 'candidate',
        content: opening.answer,
        createdAt: opening.startedAt,
      },
      {
        id: replyId,
        role: 'examiner',
        content: REPLY,
        createdAt: new Date(replyAtMs).toISOString(),
      },
      {
        id: `${opening.id}-follow-up`,
        role: 'candidate',
        content: 'Because halving can be undone.',
        createdAt: new Date(replyAtMs + FOLLOW_UP_MS).toISOString(),
      },
    ],
    attempts: [
      draftOf(replyId, 0, LEAKY_DRAFT, DRAFT_DURATIONS_MS[0]),
      draftOf(replyId, 1, REPLY, DRAFT_DURATIONS_MS[1]),
    ],
    reports: [{ turnId: replyId, categories: ['gaveAway'], comment: REPORT_COMMENT }],
    feedback: { outcome: 'foundTheMistake', comment: VERDICT_COMMENT },
    examinerConfig: {},
    notes: [],
    readAt: null,
  }
}

/**
 * Rebuilds a conversation as a long one read halfway: so many turns that neither the half already read nor the
 * rest fits on screen, the read stamp on the last of the first half.
 *
 * @param conversation - The conversation to rebuild.
 *
 * @returns The conversation, read halfway.
 */
export function partlyReadConversationOf(conversation: AdminConversation): AdminConversation {
  // When it was started, in milliseconds
  const startedAtMs = Date.parse(conversation.createdAt)

  // Every turn, the two sides taking theirs in turn, each long enough to fill a few lines
  const turns = Array.from(
    { length: PARTLY_READ_TURNS },
    (_unused, index): StoredTurn => ({
      id: `${conversation.id}-long-${index + 1}`,
      role: index % 2 === 0 ? 'examiner' : 'candidate',
      content: `Turn ${index + 1}. ${PARTLY_READ_FILLER}`,
      createdAt: new Date(startedAtMs + index * PARTLY_READ_SPACING_MS).toISOString(),
    })
  )

  // The same conversation over those turns, nothing drafted or reported on them, read up to the middle
  return {
    ...conversation,
    turns,
    attempts: [],
    reports: [],
    readAt: turns[PARTLY_READ_TURNS / 2 - 1].createdAt,
  }
}

/**
 * Checks a dialog shows a conversation {@link wholeConversationOf} built, whole: how long the reply and the
 * follow-up took, the student's report and verdict, and the drafts behind the reply.
 *
 * @param dialog - The dialog the conversation is open in.
 */
export async function expectWholeConversation(dialog: Locator): Promise<void> {
  // The reply, timed by its drafts run one after another
  await expect(dialog.getByText('9.2 s', { exact: true })).toBeVisible()

  // The follow-up, timed from the reply landing
  await expect(dialog.getByText('1 m 48 s', { exact: true })).toBeVisible()

  // The report's flag on the reply
  await expect(dialog.getByRole('img', { name: messages.defense.reported })).toBeVisible()

  // What the student said, under the conversation
  await expect(dialog.getByText(messages.admin.conversation.studentVerdict)).toBeVisible()

  // Their verdict on the whole of it
  await expect(dialog.getByText(messages.defense.outcomes.foundTheMistake)).toBeVisible()

  // In their words
  await expect(dialog.getByText(VERDICT_COMMENT)).toBeVisible()

  // What they held against the reply
  await expect(dialog.getByText(messages.defense.reportCategories.gaveAway)).toBeVisible()

  // In their words too
  await expect(dialog.getByText(REPORT_COMMENT)).toBeVisible()

  // The drafts behind the reply, opened from the reply
  await dialog
    .getByRole('button', {
      name: messages.admin.conversation.attempts.open.replace('{draftCount}', '2'),
    })
    .click()

  // The drafts dialog
  const drafts = dialog
    .page()
    .getByRole('dialog', { name: messages.admin.conversation.attempts.title })

  // Holding the draft the leak check sent back, which the student never saw
  await expect(drafts.getByText(LEAKY_DRAFT)).toBeVisible()
}

/**
 * Checks a dialog opened a conversation {@link partlyReadConversationOf} built at the line where the reading
 * stopped, rather than at either end of it.
 *
 * @param dialog - The dialog the conversation is open in.
 */
export async function expectOpensAtUnreadLine(dialog: Locator): Promise<void> {
  // The line where the last pass stopped
  const line = dialog.getByRole('separator', { name: messages.admin.conversation.unreadDivider })

  // On screen, which neither the first turn nor the last would leave it
  await expect(line).toBeInViewport()

  // With the first unread turn under it
  await expect(dialog.getByText(FIRST_UNREAD_TURN_TEXT)).toBeInViewport()
}

/**
 * Checks the switch between a student's conversations marks exactly one of them as not counting toward the grade.
 *
 * @param dialog - The dialog the conversations are open in.
 * @param count - How many conversations the switch holds.
 * @param notCounting - Which of them doesn't count, by its number.
 */
export async function expectOnlyNotCounting(
  dialog: Locator,
  count: number,
  notCounting: number
): Promise<void> {
  // All of them listed, which is the switch having arrived with what it marks
  await expect(
    dialog.getByRole('button', {
      name: new RegExp(
        `^${messages.admin.conversation.conversationNumber.replace('{number}', '\\d')}`
      ),
    })
  ).toHaveCount(count)

  // Each conversation on the switch, by its number
  for (let number = 1; number <= count; number += 1) {
    // Its button
    const button = dialog.getByRole('button', {
      name: new RegExp(
        `^${messages.admin.conversation.conversationNumber.replace('{number}', String(number))}`
      ),
    })

    // The mark saying it doesn't count
    const mark = button.getByText(messages.admin.conversation.notCounting)

    // Shown only where it is the one outside the window
    await (number === notCounting ? expect(mark).toBeVisible() : expect(mark).toHaveCount(0))
  }
}
