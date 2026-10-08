import type { Page } from '@playwright/test'

import type {
  CommentDto,
  CommentTarget,
  CommentTargetType,
} from '@/components/features/comments/services/comment-api-types'
import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type {
  Board,
  Paper,
  Proposal,
  ReviewConversation,
  ReviewTranscript,
  SelectionData,
} from '@/components/features/problem-selection/model/selection-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import messages from '../../messages/en.json'
import { answerJson, BACKEND_ORIGIN, refuse } from './backend-routes'
import { SELECTION_PATH } from './competitions'
import type { HostedBackend } from './hosted-backend'

/** How long the fake backend has to answer before a wait is called a failure. */
export const SETTLE_TIMEOUT_MS = 15_000

/** How long a read gets to go out before a test is willing to say none did. */
export const LANDING_WINDOW_MS = 1_000

/** Where the backend answers the selection's read. */
export const SELECTION_ENDPOINT = `${BACKEND_ORIGIN}/problem-selection`

/** Where the backend answers a read of one conversation in full, short of the conversation's id. */
export const CONVERSATION_ENDPOINT = `${SELECTION_ENDPOINT}/conversations/`

/** The copy the selection reads under. */
export const selectionCopy = messages.problemSelection

/**
 * How many paragraphs an English statement runs to, enough that a problem's own page scrolls well past any
 * spot a test leaves the pool at, on any machine, CI's runner included.
 */
const STATEMENT_PARAGRAPHS = 48

/** {@link BILINGUAL}'s statement in Slovak. */
export const SLOVAK_STATEMENT =
  'Na tabuli sú čísla od jeden do sto a dvaja hráči ich striedavo zotierajú.'

/** {@link BILINGUAL}'s hint, in English. */
export const HINT = 'Pair the numbers up.'

/** The paragraph an author adds to a problem's statement in revising it. */
export const REVISION = 'Revised: the two numbers left must also differ by more than one.'

/**
 * A problem's statement, {@link STATEMENT_PARAGRAPHS} paragraphs of the same erasing game.
 *
 * @param number - The number of the problem it states.
 *
 * @returns The statement as markdown.
 */
function statementOf(number: number): string {
  // Paragraph after paragraph of the same game, each saying which problem it belongs to
  return Array.from(
    { length: STATEMENT_PARAGRAPHS },
    (_unused, index) =>
      `Part ${index + 1} of problem ${number}. A board holds the numbers from one to a hundred, and two ` +
      'players take turns erasing one of them until only two are left, the first player winning when ' +
      'those two are coprime.'
  ).join('\n\n')
}

/**
 * One problem in the selection, written in English alone and on offer, as most proposals start out.
 *
 * @param number - The number it is quoted by.
 * @param distinction - What sets the problem apart from one on offer in English alone.
 *
 * @returns The problem.
 */
function proposalNumbered(number: number, distinction: Partial<Proposal> = {}): Proposal {
  // The problem, its id built from its number so every problem gets its own, and whatever sets it apart laid on top
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    number,
    title: `Erasing game ${number}`,
    area: 'combinatorics',
    recommended: ['intermediate'],
    texts: { en: { statement: statementOf(number), solution: null, hints: [] } },
    isSetAside: false,
    isUsed: false,
    ...distinction,
  }
}

/** A problem on offer, partway down the pool. */
export const OPENED = proposalNumbered(4)

/** A problem written in Slovak as well, solved and hinted in English alone. */
export const BILINGUAL = proposalNumbered(2, {
  texts: {
    en: {
      statement: statementOf(2),
      solution: 'The first player pairs every number with its neighbour.',
      hints: [HINT],
    },
    sk: { statement: SLOVAK_STATEMENT, solution: null, hints: [] },
  },
})

/** A problem proposed before anybody wrote its statement, in any language. */
export const UNWRITTEN = proposalNumbered(9, { texts: {} })

/** The pool's first problem. */
export const FIRST = proposalNumbered(1)

/** The problem the reviewers have set aside. */
export const SET_ASIDE = proposalNumbered(3, { isSetAside: true })

/**
 * A problem's texts written and solved in every language, as a round needs them.
 *
 * @param number - The number of the problem they belong to.
 *
 * @returns The texts.
 */
function textsInEveryLanguage(number: number): Proposal['texts'] {
  // A statement and a solution in each language
  return {
    en: {
      statement: statementOf(number),
      solution: 'Pair every number with the next one.',
      hints: [],
    },
    sk: { statement: 'Hra so zotieraním čísel.', solution: 'Spárujte susedné čísla.', hints: [] },
    cs: { statement: 'Hra se škrtáním čísel.', solution: 'Spárujte sousední čísla.', hints: [] },
  }
}

/** A problem written and solved in every language, which no round would refuse. */
export const READY = proposalNumbered(5, { texts: textsInEveryLanguage(5) })

/** The pool's one geometry problem, recommended for the advanced category alone. */
export const GEOMETRY = proposalNumbered(6, { area: 'geometry', recommended: ['advanced'] })

/** The problem a round has taken, written and solved in every language as the round needed it. */
export const USED = proposalNumbered(7, { isUsed: true, texts: textsInEveryLanguage(7) })

/** The pool's one algebra problem, recommended for the elementary category and the intermediate one. */
export const ALGEBRA = proposalNumbered(8, {
  area: 'algebra',
  recommended: ['elementary', 'intermediate'],
})

/** Every problem the selection holds, lowest number first, {@link SET_ASIDE} and {@link USED} among them. */
const SELECTION: Proposal[] = [
  FIRST,
  BILINGUAL,
  SET_ASIDE,
  OPENED,
  READY,
  GEOMETRY,
  USED,
  ALGEBRA,
  UNWRITTEN,
]

/** How many problems the pool offers: every one in the selection neither set aside nor taken by a round. */
export const ON_OFFER_COUNT = 7

/**
 * One paper on a board, its slots naming their problems by id as the backend sends them.
 *
 * @param index - Which of the fake's papers it is, which its id is built from.
 * @param name - What the paper is called.
 * @param category - The category it fills; null for a paper outside the categories.
 * @param slots - The problem in each slot, null where the slot stands empty.
 *
 * @returns The paper.
 */
function paperOf(
  index: number,
  name: string,
  category: HostedCompetitionCategory | null,
  slots: (Proposal | null)[]
): Paper {
  // The paper, its id built from its index so every paper gets its own
  return {
    id: `00000000-0000-4000-8000-a${String(index).padStart(11, '0')}`,
    name,
    category,
    slots: slots.map((proposal) => proposal?.id ?? null),
  }
}

/**
 * A board finalized into October's rounds, the oldest one. Its paper's slots are what the round took, so
 * {@link USED} is there and no slot stands empty, the way the backend reads a finalized board off its rounds.
 */
export const FINALIZED_BOARD: Board = {
  id: '00000000-0000-4000-8000-b00000000001',
  name: 'October 2026',
  papers: [paperOf(1, 'Elementary', 'elementary', [USED])],
  finalization: { cycleName: 'October', opensAt: '2026-10-18T22:00:00+00:00' },
}

/** The first draft: {@link FIRST} in E1, {@link READY} in I2, and the advanced paper still empty. */
export const DRAFT_BOARD: Board = {
  id: '00000000-0000-4000-8000-b00000000002',
  name: 'November 2026',
  papers: [
    paperOf(2, 'Elementary', 'elementary', [FIRST, null, null]),
    paperOf(3, 'Intermediate', 'intermediate', [null, READY, null]),
    paperOf(4, 'Advanced', 'advanced', [null, null, null]),
  ],
  finalization: null,
}

/**
 * A draft after {@link DRAFT_BOARD}: {@link READY}, which that board holds too, {@link GEOMETRY}, and
 * {@link SET_ASIDE} in a paper outside the categories.
 */
export const LATER_DRAFT: Board = {
  id: '00000000-0000-4000-8000-b00000000003',
  name: 'December 2026',
  papers: [
    paperOf(5, 'Elementary', 'elementary', [READY, null]),
    paperOf(6, 'Advanced', 'advanced', [GEOMETRY, null]),
    paperOf(7, 'Spare', null, [null, SET_ASIDE]),
  ],
  finalization: null,
}

/** The boards most replies hold, oldest first as the backend sends them, the finalized one ahead of the drafts. */
const BOARDS: Board[] = [FINALIZED_BOARD, DRAFT_BOARD, LATER_DRAFT]

/** A draft older than {@link LATER_DRAFT} whose one paper is full, {@link READY} in it, ready to be finalized. */
export const FULL_DRAFT: Board = {
  id: '00000000-0000-4000-8000-b00000000004',
  name: 'Autumn 2026',
  papers: [paperOf(8, 'Elementary', 'elementary', [READY])],
  finalization: null,
}

/** {@link FULL_DRAFT} finalized into November's rounds, its slot now the round's problem. */
const FULL_DRAFT_FINALIZED: Board = {
  ...FULL_DRAFT,
  finalization: { cycleName: 'November', opensAt: '2026-11-15T23:00:00+00:00' },
}

/** {@link LATER_DRAFT} once {@link FULL_DRAFT}'s round has taken {@link READY}, which leaves every draft it stood on. */
const LATER_DRAFT_WITHOUT_READY: Board = {
  ...LATER_DRAFT,
  papers: LATER_DRAFT.papers.map((paper) => ({
    ...paper,
    slots: paper.slots.map((slot) => (slot === READY.id ? null : slot)),
  })),
}

/** {@link OPENED} as its author revised it, with a paragraph added at the end. */
const REVISED = proposalNumbered(OPENED.number, {
  texts: {
    en: { statement: `${statementOf(OPENED.number)}\n\n${REVISION}`, solution: null, hints: [] },
  },
})

/**
 * The selection as a later read brings it: {@link REVISED} in place of {@link OPENED}, and {@link FIRST} set aside.
 */
const LATER_SELECTION = SELECTION.map((proposal) => {
  // The problem its author revised meanwhile
  if (proposal === OPENED) return REVISED

  // The problem another reviewer set aside meanwhile
  if (proposal === FIRST) return { ...FIRST, isSetAside: true }

  // Every other problem as it was
  return proposal
})

/**
 * {@link BILINGUAL} as its author revised it in English, with a paragraph added at the end, its Slovak statement
 * left as it was.
 */
const BILINGUAL_REVISED: Proposal = {
  ...BILINGUAL,
  texts: {
    ...BILINGUAL.texts,
    en: { ...BILINGUAL.texts.en!, statement: `${statementOf(BILINGUAL.number)}\n\n${REVISION}` },
  },
}

/**
 * The address a link to {@link OPENED} carries. The parameter is written out rather than imported, since links
 * already shared carry this exact name.
 */
export const OPENED_ADDRESS = `${SELECTION_PATH}?problem=${OPENED.id}`

/** The reviewer who argued {@link OPENED} with Mathilda most recently, and wrote into its discussion. */
export const REVIEWER = 'Zuzana'

/** What {@link REVIEWER} argued about {@link OPENED}. */
export const ARGUED =
  'The second player mirrors every move, so the two numbers left are always neighbours.'

/** {@link OPENED}'s statement as it stood before its author revised it into the one the selection holds. */
export const EARLIER_STATEMENT =
  'A board holds the numbers from one to fifty, and two players take turns erasing one of them.'

/** What a reviewer with no username argued about {@link EARLIER_STATEMENT}. */
export const ARGUED_EARLIER = 'Erasing the odd numbers first leaves only even ones.'

/** The username of the reviewer a test signs in as, where one is needed to sign a comment. */
export const READER_NAME = 'Rita'

/**
 * One thing said in a conversation with Mathilda.
 *
 * @param id - The turn's id.
 * @param role - Who said it.
 * @param content - What was said.
 * @param createdAt - When it was said, as an ISO-8601 string.
 *
 * @returns The turn, as the backend stores it.
 */
function turnOf(
  id: string,
  role: StoredTurn['role'],
  content: string,
  createdAt: string
): StoredTurn {
  // The turn as the backend stores it
  return { id, role, content, createdAt }
}

/**
 * A conversation a reviewer held with Mathilda about a problem, as the backend keeps it.
 */
type HeldConversation = Pick<ReviewConversation, 'id' | 'proposalId' | 'author' | 'startedAt'> & {
  /** The statement it was argued against, and everything said. */
  transcript: ReviewTranscript
}

/** {@link REVIEWER}'s conversation about {@link OPENED}, argued against the statement it has now. */
export const RECENT: HeldConversation = {
  id: '00000000-0000-4000-8000-c00000000001',
  proposalId: OPENED.id,
  author: REVIEWER,
  startedAt: '2026-09-28T10:00:00.000Z',
  transcript: {
    savedStatement: statementOf(OPENED.number),
    turns: [
      turnOf('t-recent-1', 'examiner', 'Tell me how you got there.', '2026-09-28T10:00:00.000Z'),
      turnOf('t-recent-2', 'candidate', ARGUED, '2026-09-28T10:01:00.000Z'),
      turnOf('t-recent-3', 'examiner', 'Why are they neighbours?', '2026-09-28T10:02:00.000Z'),
    ],
  },
}

/** A conversation about {@link OPENED} held by a reviewer with no username, argued against its earlier statement. */
export const EARLIER: HeldConversation = {
  id: '00000000-0000-4000-8000-c00000000002',
  proposalId: OPENED.id,
  author: null,
  startedAt: '2026-09-14T09:00:00.000Z',
  transcript: {
    savedStatement: EARLIER_STATEMENT,
    turns: [
      turnOf('t-earlier-1', 'examiner', 'Tell me how you got there.', '2026-09-14T09:00:00.000Z'),
      turnOf('t-earlier-2', 'candidate', ARGUED_EARLIER, '2026-09-14T09:01:00.000Z'),
    ],
  },
}

/** What {@link REVIEWER} wrote into {@link OPENED}'s discussion. */
export const OPENED_COMMENT: CommentDto = {
  id: '00000000-0000-4000-8000-d00000000001',
  author: { id: 'user_zuzana', name: REVIEWER, avatarUrl: null },
  content: 'Fits the intermediate paper, with a hint for the last part.',
  createdAt: '2026-09-29T08:00:00.000Z',
  editedAt: null,
  isDeleted: false,
  likeCount: 0,
  isLiked: false,
  replies: [],
}

/**
 * What the backend behind the selection keeps besides the problems, which every read about them answers out of.
 */
type SelectionMemory = {
  /** The conversations reviewers held with Mathilda before the test began, as many as are still held. */
  conversations: HeldConversation[]
  /** Each problem's discussion, by the problem's id, oldest comment first. */
  discussions: Map<string, CommentDto[]>
  /** The backend the chat with Mathilda talks to, whose conversations are held as well; null where none is. */
  chat: HostedBackend | null
}

/**
 * What the backend keeps as a test begins: {@link RECENT} and {@link EARLIER} about {@link OPENED}, and
 * {@link OPENED_COMMENT} under it.
 *
 * @param chat - The backend the chat with Mathilda talks to; null where the test talks to her nowhere.
 *
 * @returns The memory, for the test to change as it goes.
 */
export function rememberedSelection(chat: HostedBackend | null): SelectionMemory {
  // The memory, fresh for each test so nothing one writes reaches the next
  return {
    conversations: [RECENT, EARLIER],
    discussions: new Map([[OPENED.id, [OPENED_COMMENT]]]),
    chat,
  }
}

/**
 * Every conversation the backend holds about a problem still in the selection, the ones held through the chat
 * included.
 *
 * @param memory - What the backend keeps.
 * @param proposals - Every problem the selection holds.
 *
 * @returns The conversations, in no particular order.
 */
function heldConversations(memory: SelectionMemory, proposals: Proposal[]): HeldConversation[] {
  // Each conversation held through the chat, by a reviewer with no username as the ambient profile has it
  const chatted = proposals.flatMap((proposal) =>
    (memory.chat?.sessionsAbout(proposal.id) ?? []).map(
      (session): HeldConversation => ({
        id: session.id,
        proposalId: proposal.id,
        author: null,
        // Started on Mathilda's greeting, which every conversation opens with
        startedAt: session.turns[0]!.createdAt,
        transcript: { savedStatement: session.statement, turns: session.turns },
      })
    )
  )

  // The conversations held through the chat and before the test, where the selection still holds the problem
  return [...memory.conversations, ...chatted].filter((conversation) =>
    proposals.some((proposal) => proposal.id === conversation.proposalId)
  )
}

/**
 * The selection as the backend reads it: the problems, the boards, and every conversation held about the problems
 * in the shape the list of them takes.
 *
 * @param memory - What the backend keeps.
 * @param proposals - Every problem the selection holds.
 * @param boards - Every board the selection holds, oldest first.
 *
 * @returns The selection.
 */
function selectionOf(
  memory: SelectionMemory,
  proposals: Proposal[],
  boards: Board[]
): SelectionData {
  // Each conversation listed, with how much was said and whether the statement it was argued against is
  // gone from the problem in every language
  const conversations = heldConversations(memory, proposals).map(
    ({ id, proposalId, author, startedAt, transcript }): ReviewConversation => ({
      id,
      proposalId,
      author,
      startedAt,
      messageCount: transcript.turns.length,
      hasOlderStatement: !proposals.some(
        (proposal) =>
          proposal.id === proposalId &&
          Object.values(proposal.texts).some(
            (text) => text?.statement === transcript.savedStatement
          )
      ),
    })
  )

  // The problems, the boards, and the conversations newest first
  return {
    proposals,
    boards,
    conversations: conversations.sort((first, second) =>
      second.startedAt.localeCompare(first.startedAt)
    ),
  }
}

/**
 * How the backend answers the selection's read.
 */
type SelectionReply =
  /** With every problem in the selection, and every conversation held about one. */
  | 'selection'
  /** With every problem as a later read finds them, and the conversations about them. */
  | 'later'
  /** With every problem in the selection, one of them revised in English, and the conversations about them. */
  | 'revisedInEnglish'
  /** With every problem in the selection, and {@link FULL_DRAFT} ahead of {@link LATER_DRAFT} as the only boards. */
  | 'fullDraft'
  /** With {@link FULL_DRAFT} finalized meanwhile, its round having taken {@link READY}. */
  | 'fullDraftFinalized'
  /** Refused with the code an account that does not prepare competitions earns. */
  | 'forbidden'
  /** Refused for good with no code at all, as an address the backend does not serve is. */
  | 'failure'

/**
 * Every problem the backend holds while it answers the selection's read a given way.
 *
 * @param reply - How the read is answered.
 *
 * @returns The problems, lowest number first.
 */
function proposalsHeldAt(reply: SelectionReply): Proposal[] {
  switch (reply) {
    // Every problem as first read, which a refusal or a failure of the read leaves as it stands
    case 'selection':
    case 'fullDraft':
    case 'forbidden':
    case 'failure':
      return SELECTION

    // Every problem as first read, but for the ready one, which the full draft's round has taken
    case 'fullDraftFinalized':
      return SELECTION.map((proposal) =>
        proposal === READY ? { ...READY, isUsed: true } : proposal
      )

    // Every problem as a later read finds them, one revised and another set aside
    case 'later':
      return LATER_SELECTION

    // Every problem as first read, but for the one revised in English
    case 'revisedInEnglish':
      return SELECTION.map((proposal) => (proposal === BILINGUAL ? BILINGUAL_REVISED : proposal))

    // Every reply is handled above
    default:
      return assertNever(reply)
  }
}

/**
 * Every board the backend holds while it answers the selection's read a given way.
 *
 * @param reply - How the read is answered.
 *
 * @returns The boards, oldest first.
 */
function boardsHeldAt(reply: SelectionReply): Board[] {
  switch (reply) {
    // The finalized board and the drafts after it, however the problems stand
    case 'selection':
    case 'later':
    case 'revisedInEnglish':
    case 'forbidden':
    case 'failure':
      return BOARDS

    // The full draft, ahead of the later one
    case 'fullDraft':
      return [FULL_DRAFT, LATER_DRAFT]

    // The full draft finalized, still ahead of the later one, which its problem has left
    case 'fullDraftFinalized':
      return [FULL_DRAFT_FINALIZED, LATER_DRAFT_WITHOUT_READY]

    // Every reply is handled above
    default:
      return assertNever(reply)
  }
}

/**
 * A function which answers every read of the selection from then on with the reply given.
 *
 * @param reply - How every read is answered from then on.
 */
type AnswerSelectionWith = (reply: SelectionReply) => void

/**
 * What writing a comment sends, in as much of it as the fake reads.
 */
type CommentRequestBody = {
  /** The thread it goes into. */
  target: CommentTarget
  /** What it says. */
  content: string
}

/**
 * What asking for comment counts sends.
 */
type CountsRequestBody = {
  /** The kind of thread counted. */
  targetType: CommentTargetType
  /** The threads counted, by their ids. */
  targetIds: string[]
}

/**
 * Stands in for the selection's backend: the selection's read, with a reply the test can change midway, the
 * conversations it lists read out in full, and each problem's discussion with its count. The chat in its memory,
 * where there is one, reads the problems' statements from the same reply.
 *
 * @param page - The page to answer the selection's calls on.
 * @param firstReply - How the reads are answered until the test says otherwise.
 * @param memory - What the backend keeps besides the problems.
 *
 * @returns A function which changes how the reads are answered from then on.
 */
export async function stubSelection(
  page: Page,
  firstReply: SelectionReply,
  memory: SelectionMemory = rememberedSelection(null)
): Promise<AnswerSelectionWith> {
  // How every read is answered right now
  let reply = firstReply

  // The chat reading each problem's statements as the reply holds them right now, so a revision reaches it too
  memory.chat?.statementsFrom((problemId) => {
    // The problem, absent where the selection does not hold it
    const proposal = proposalsHeldAt(reply).find((candidate) => candidate.id === problemId)

    // The problem's statement in each language it is written in
    return Object.fromEntries(
      Object.entries(proposal?.texts ?? {}).flatMap(([locale, text]) =>
        text === undefined ? [] : [[locale, text.statement]]
      )
    )
  })

  // Stand in for the read
  await page.route(SELECTION_ENDPOINT, async (route) => {
    // Answered the way the test last asked for
    switch (reply) {
      // Every problem and board the reply holds, with the conversations held about the problems
      case 'selection':
      case 'later':
      case 'revisedInEnglish':
      case 'fullDraft':
      case 'fullDraftFinalized':
        return answerJson(
          route,
          200,
          selectionOf(memory, proposalsHeldAt(reply), boardsHeldAt(reply))
        )

      // Refused, in the shape the backend writes an authorization failure as
      case 'forbidden':
        return refuse(route, 403, 'Forbidden')

      // Refused, with nothing to say why
      case 'failure':
        return route.fulfill({ status: 404 })

      // Every reply is handled above
      default:
        return assertNever(reply)
    }
  })

  // Everything said in one conversation, which is read only once somebody opens it
  await page.route(`${CONVERSATION_ENDPOINT}*`, async (route) => {
    // Which conversation
    const conversationId = new URL(route.request().url()).pathname.split('/').pop() ?? ''

    // Held about a problem the selection still holds
    const held = heldConversations(memory, proposalsHeldAt(reply)).find(
      (conversation) => conversation.id === conversationId
    )

    // One the backend no longer holds, or holds about a problem gone from the selection
    if (held === undefined) {
      return refuse(route, 404, 'SelectionTargetNotFound')
    }

    // The statement it was argued against, and what was said
    return answerJson(route, 200, held.transcript)
  })

  // A problem's discussion, and a comment written into it. Any other kind of thread goes to the stubs beneath
  await page.route(`${BACKEND_ORIGIN}/comments*`, async (route) => {
    // The call as it went out
    const request = route.request()

    // Reading a thread, or writing into one
    switch (request.method()) {
      // The thread, by the problem it hangs off
      case 'GET': {
        // Which thread
        const query = new URL(request.url()).searchParams

        // Another kind of thread
        if (query.get('targetType') !== ('Proposal' satisfies CommentTargetType)) {
          return route.fallback()
        }

        // The problem it hangs off
        const proposalId = query.get('targetId') ?? ''

        // A problem the selection does not hold, which here is one no proposal files, has no thread to read
        if (!proposalsHeldAt(reply).some((proposal) => proposal.id === proposalId)) {
          return refuse(route, 404, 'CommentTargetNotFound')
        }

        // Every comment in it, oldest first
        return answerJson(route, 200, memory.discussions.get(proposalId) ?? [])
      }

      // A comment, written into a thread
      case 'POST': {
        // What was written, and where
        const { target, content } = request.postDataJSON() as CommentRequestBody

        // Another kind of thread
        if (target.targetType !== 'Proposal') {
          return route.fallback()
        }

        // The comment, signed by the reviewer the test signs in as
        const comment: CommentDto = {
          id: crypto.randomUUID(),
          author: { id: 'user_reader', name: READER_NAME, avatarUrl: null },
          content,
          createdAt: new Date().toISOString(),
          editedAt: null,
          isDeleted: false,
          likeCount: 0,
          isLiked: false,
          replies: [],
        }

        // At the end of the problem's discussion
        memory.discussions.set(target.targetId, [
          ...(memory.discussions.get(target.targetId) ?? []),
          comment,
        ])

        // Answered with the comment, as created
        return answerJson(route, 201, comment)
      }

      // Any other call, handed on to the stubs beneath
      default:
        return route.fallback()
    }
  })

  // How many comments each problem's discussion holds
  await page.route(`${BACKEND_ORIGIN}/comments/counts`, async (route) => {
    // Which threads are counted
    const { targetType, targetIds } = route.request().postDataJSON() as CountsRequestBody

    // Another kind of thread, which no stub here counts
    if (targetType !== 'Proposal') {
      return route.fallback()
    }

    // Each problem with anything said under it, the backend leaving out the ones with nothing
    const counts = Object.fromEntries(
      targetIds.flatMap((proposalId) => {
        // How many comments it holds
        const count = memory.discussions.get(proposalId)?.length ?? 0

        // Kept only where there are any
        return count === 0 ? [] : [[proposalId, count]]
      })
    )

    // The counts, by problem
    return answerJson(route, 200, counts)
  })

  // The way to change the reply
  return (nextReply) => {
    // Every read from here on answered this way
    reply = nextReply
  }
}

/**
 * A problem's card in the pool.
 *
 * @param page - The page.
 * @param proposal - The problem.
 *
 * @returns The card.
 */
export function cardOf(page: Page, proposal: Proposal) {
  // The pool's only card naming the problem
  return page.getByRole('article').filter({ hasText: proposal.title })
}

/**
 * A problem's heading, which only its own page shows.
 *
 * @param page - The page.
 * @param proposal - The problem.
 *
 * @returns The heading.
 */
export function headingOf(page: Page, proposal: Proposal) {
  // The page's only second-level heading naming the problem
  return page.getByRole('heading', { level: 2, name: proposal.title })
}
