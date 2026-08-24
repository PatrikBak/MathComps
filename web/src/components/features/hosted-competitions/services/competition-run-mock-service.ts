'use client'

import type { CompetitionDefenseTarget } from '@/components/features/defense/model/defense-target'
import type {
  DefenseSession,
  DefenseSessionList,
  DefenseTurnRequest,
  StoredTurn,
} from '@/components/features/defense/model/defense-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { delay } from '@/components/shared/utils/async-utils'
import { MINUTE_MS } from '@/components/shared/utils/time-units'
import type { LocalizedString } from '@/i18n/i18n'
import type { ApiResult } from '@/types/api'

import type {
  HostedCompetitionDefenseLine,
  HostedCompetitionProblem,
} from '../model/hosted-competition-types'
import type { HostedCompetitionScenario } from './hosted-competition-mock-service'
import {
  currentScenario,
  findMockEntryClockEnd,
  RESPONSE_DELAY_MS,
} from './hosted-competition-mock-service'
import { readMockState, writeMockState } from './mock-persistence'

/**
 * What one entry is held to, standing in for the competition's own setup until it has one.
 */
const MOCK_LIMITS = {
  maxCandidateChars: 4000,
  maxFeedbackCommentChars: 1000,
  maxTurnsPerSession: 20,
}

/** How many problems a competition's set holds. */
const PROBLEMS_PER_COMPETITION = 3

/**
 * The statements a competition sets, in the order it sets them.
 *
 * Written out because the archive holds no embargoed problems yet, and real typeset maths is what a
 * student can actually read and argue about.
 */
const STATEMENTS: LocalizedString[] = [
  {
    sk: 'Nájdite všetky dvojice kladných celých čísel $(a, b)$ také, že $a^2 + b$ aj $b^2 + a$ sú druhé mocniny celých čísel.',
    cs: 'Najděte všechny dvojice kladných celých čísel $(a, b)$ takové, že $a^2 + b$ i $b^2 + a$ jsou druhé mocniny celých čísel.',
    en: 'Find all pairs of positive integers $(a, b)$ such that both $a^2 + b$ and $b^2 + a$ are perfect squares.',
  },
  {
    sk: 'Nech $ABC$ je ostrouhlý trojuholník s výškami $AD$, $BE$ a $CF$. Dokážte, že priamka $EF$ je kolmá na priamku $AO$, kde $O$ je stred opísanej kružnice trojuholníka $ABC$.',
    cs: 'Nechť $ABC$ je ostroúhlý trojúhelník s výškami $AD$, $BE$ a $CF$. Dokažte, že přímka $EF$ je kolmá na přímku $AO$, kde $O$ je střed kružnice opsané trojúhelníku $ABC$.',
    en: 'Let $ABC$ be an acute triangle with altitudes $AD$, $BE$ and $CF$. Prove that the line $EF$ is perpendicular to the line $AO$, where $O$ is the circumcentre of triangle $ABC$.',
  },
  {
    sk: 'Na tabuli je napísaných $n$ jednotiek. V každom kroku zmažeme dve čísla $x$ a $y$ a napíšeme namiesto nich $\\frac{x + y}{4}$. Pre ktoré $n$ vieme dosiahnuť, aby na tabuli zostalo jediné číslo aspoň $\\frac{1}{n}$?',
    cs: 'Na tabuli je napsáno $n$ jedniček. V každém kroku smažeme dvě čísla $x$ a $y$ a napíšeme místo nich $\\frac{x + y}{4}$. Pro která $n$ dokážeme docílit, aby na tabuli zbylo jediné číslo alespoň $\\frac{1}{n}$?',
    en: 'The number $1$ is written on a board $n$ times. At each step we erase two numbers $x$ and $y$ and write $\\frac{x + y}{4}$ in their place. For which $n$ can we make the single remaining number at least $\\frac{1}{n}$?',
  },
]

/**
 * The examiner's opening line, which the backend owns and every transcript starts on.
 */
const OPENER =
  'Tell me how you approached this one. Start wherever your argument starts, not where the problem does.'

/**
 * What the examiner says next, cycled by how many turns the student has spent.
 *
 * A mock cannot argue, so these probe without claiming to have read anything.
 */
const SCRIPTED_REPLIES = [
  'That is a step, but it is not yet a reason. What forces it to hold rather than merely happen to?',
  'Take the case you skipped over. Does the same argument survive it, or does it need a second idea?',
  'You are asserting the bound. Show me where it comes from, in one line if you can.',
  'Good. Now the other direction: what would have to be true for this to fail?',
]

/**
 * The mocked backend's memory: every competition problem's transcripts, by problem.
 *
 * Held per scenario and built on first ask, so a turn sent sticks across a refetch and switching scenarios
 * never rewrites what another one was showing.
 */
const problemStates = new Map<string, DefenseSession[]>()

/** Counts the ids this module has minted, so nothing it makes collides with anything else it made. */
let mintCount = 0

/** Where the transcripts are held so a reload finds them. */
const TRANSCRIPTS_STATE_KEY = 'competition-run'

/** Whether what the last reload left behind has been read back yet. */
let isHydrated = false

/**
 * What survives a reload: every problem's transcripts, and the counter their ids were minted from.
 *
 * Without the counter a restored session and a freshly minted one collide on the same id, and the modal
 * opens the wrong conversation.
 */
type HeldTranscripts = {
  /** Each problem's transcripts, by the key naming the problem. */
  sessions: Record<string, DefenseSession[]>
  /** How many ids had been minted when it was written. */
  mintCount: number
}

/**
 * Puts back whatever the reader wrote before the last reload, once per page load.
 */
function hydrate(): void {
  // Already read back, or nothing to read
  if (isHydrated) {
    return
  }

  // Whatever happens below, this page load has had its one read
  isHydrated = true

  // What the last one left behind
  const held = readMockState<HeldTranscripts>(TRANSCRIPTS_STATE_KEY)

  // Nothing was left, so the seeds stand
  if (held === null) {
    return
  }

  // Put every problem's transcripts back where they were
  for (const [key, sessions] of Object.entries(held.sessions)) {
    problemStates.set(key, sessions)
  }

  // And carry on minting ids from where it stopped
  mintCount = held.mintCount
}

/**
 * Holds the transcripts as they now stand, so the next reload finds them rather than a fresh seed.
 */
function holdTranscripts(): void {
  writeMockState(TRANSCRIPTS_STATE_KEY, {
    sessions: Object.fromEntries(problemStates),
    mintCount,
  } satisfies HeldTranscripts)
}

/**
 * Mints an id nothing else in the mock holds.
 *
 * @param prefix - What kind of thing is being named.
 *
 * @returns The id.
 */
function mintId(prefix: string): string {
  // The next one this module has never handed out
  return `${prefix}-${(mintCount += 1)}`
}

/**
 * Names one problem of a competition's set.
 *
 * @param competitionId - Which competition sets it.
 * @param position - Where it sits in the set, counting from one.
 *
 * @returns The problem's id.
 */
function problemIdOf(competitionId: string, position: number): string {
  // The competition it belongs to, and where in the set it sits
  return `${competitionId}-p${position}`
}

/**
 * Where a problem's transcripts are held.
 *
 * @param scenario - Which set of facts they belong to.
 * @param competitionId - Which competition sets the problem.
 * @param problemId - Which problem they are about.
 *
 * @returns The key.
 */
function stateKey(
  scenario: HostedCompetitionScenario,
  competitionId: string,
  problemId: string
): string {
  // One key per scenario, competition and problem
  return `${scenario}:${competitionId}:${problemId}`
}

/**
 * Builds one stored turn.
 *
 * @param role - Who authored it.
 * @param content - What it says.
 * @param at - When it was authored, in epoch milliseconds.
 *
 * @returns The turn, as the backend would have saved it.
 */
function storedTurn(role: StoredTurn['role'], content: string, at: number): StoredTurn {
  // The turn, named and stamped the way a save would have left it
  return { id: mintId('turn'), createdAt: new Date(at).toISOString(), role, content }
}

/**
 * Seeds the transcripts a problem opens with.
 *
 * The first problem of an entry carries a conversation straddling the clock's end, so the boundary is
 * there to read on arrival instead of only after somebody waits a two-hour clock out.
 *
 * @param competitionId - Which competition sets the problem.
 * @param problemId - Which problem the transcripts are about.
 * @param position - Where the problem sits in the set, counting from one.
 *
 * @returns The transcripts, most recently active first.
 */
function seedSessions(
  competitionId: string,
  problemId: string,
  position: number
): DefenseSession[] {
  // Only the first problem opens with anything to read
  if (position !== 1) {
    return []
  }

  // Where the counted part of this entry ends, which is what the seeded turns are placed around
  const clockEnd = findMockEntryClockEnd(competitionId)

  // Nothing was ever sat here, so there is nothing to have said
  if (clockEnd === null) {
    return []
  }

  // The instant the boundary falls on
  const endsAtMs = Date.parse(clockEnd)

  // Whether that instant has already passed, which is what makes a straddling transcript possible at all
  const isSpent = endsAtMs <= Date.now()

  // The counted part, which sits inside the clock either way
  const turns = [
    storedTurn('examiner', OPENER, endsAtMs - 40 * MINUTE_MS),
    storedTurn(
      'candidate',
      'I claim the only solutions are $a = b$. Suppose $a^2 + b = k^2$ for some integer $k$.',
      endsAtMs - 38 * MINUTE_MS
    ),
    storedTurn('examiner', SCRIPTED_REPLIES[0]!, endsAtMs - 37 * MINUTE_MS),
    storedTurn(
      'candidate',
      'Because $a^2 < a^2 + b < (a + 1)^2$ whenever $b \\le 2a$, so there is no square strictly between them.',
      endsAtMs - 30 * MINUTE_MS
    ),
    storedTurn('examiner', SCRIPTED_REPLIES[1]!, endsAtMs - 29 * MINUTE_MS),
  ]

  // And one exchange the clock no longer covers, once the boundary is behind us
  if (isSpent) {
    turns.push(
      storedTurn(
        'candidate',
        'Coming back to the case $b > 2a$ now that my time is gone: I think it forces $b = a^2 + a$.',
        endsAtMs + 4 * MINUTE_MS
      ),
      storedTurn('examiner', SCRIPTED_REPLIES[2]!, endsAtMs + 5 * MINUTE_MS)
    )
  }

  // The one conversation the problem opens with
  return [
    {
      id: mintId('session'),
      // Seeded rather than typed by anybody, so nobody's name is on it
      target: { kind: 'competition', competitionId, problemId, readerKey: null },
      turns,
      feedback: null,
      reports: [],
    },
  ]
}

/**
 * The transcripts a problem currently holds, built on the first ask.
 *
 * @param competitionId - Which competition sets the problem.
 * @param problemId - Which problem they are about.
 * @param position - Where the problem sits in the set, counting from one.
 *
 * @returns The sessions, which the caller may write through.
 */
function sessionsOf(competitionId: string, problemId: string, position: number): DefenseSession[] {
  // Whatever the last reload left behind
  hydrate()

  // Where this scenario keeps them
  const key = stateKey(currentScenario(), competitionId, problemId)

  // What it already holds
  const existing = problemStates.get(key)

  // Already built, whether by a seed or by a reload
  if (existing !== undefined) {
    return existing
  }

  // Nothing yet, so seed it
  const created = seedSessions(competitionId, problemId, position)

  // Which is what this problem holds from here on
  problemStates.set(key, created)

  // And what the next reload should find
  holdTranscripts()

  // The freshly seeded transcripts
  return created
}

/**
 * Says how a problem's row should read one of its conversations.
 *
 * @param session - The conversation being summarized.
 *
 * @returns Its line.
 */
function lineOf(session: DefenseSession): HostedCompetitionDefenseLine {
  // A conversation always opens on the examiner, so its first turn is when the student started
  const startedAt = session.turns[0]?.createdAt ?? new Date().toISOString()

  // Enough to choose between conversations, and no more
  return {
    sessionId: session.id,
    startedAt,
    turnsSpent: session.turns.filter((turn) => turn.role === 'candidate').length,
    maxTurns: MOCK_LIMITS.maxTurnsPerSession,
  }
}

/**
 * Builds one competition's problem set, with whatever the student has said about each.
 *
 * Shared with the call that spends the entry, which answers with the set the entry bought.
 *
 * @param competitionId - Which competition's problems are being built.
 *
 * @returns The problems in the order the competition sets them.
 */
export function buildCompetitionProblems(competitionId: string): HostedCompetitionProblem[] {
  // The set, each problem carrying its own conversations
  return Array.from({ length: PROBLEMS_PER_COMPETITION }, (_, index) => {
    // Where this one sits in the set
    const position = index + 1

    // What names it
    const id = problemIdOf(competitionId, position)

    // The problem, carrying whatever has been said about it
    return {
      id,
      position,
      statement: STATEMENTS[index]!,
      defenses: sessionsOf(competitionId, id, position).map(lineOf),
    }
  })
}

/**
 * Drops every conversation held against one competition's problems.
 *
 * A fresh entry is a fresh run, and nothing the last one said belongs in it. The transcripts are keyed by
 * competition and problem, both of which outlive the entry, so the practice competition, the only one
 * anybody takes twice, opens its second run listing the first one's arguments, every one of them dated
 * before the new clock started.
 *
 * Each problem is left holding an empty list: one holding nothing at all is what {@link seedSessions}
 * writes an opening conversation for, and the same stale reading comes straight back.
 *
 * @param competitionId - Whose problems are being cleared.
 */
export function clearCompetitionTranscripts(competitionId: string): void {
  // Whatever the last reload left behind, which is part of what is being cleared
  hydrate()

  // Every problem of the set, each left holding an empty list
  Array.from({ length: PROBLEMS_PER_COMPETITION }, (_, index) =>
    problemIdOf(competitionId, index + 1)
  ).forEach((problemId) => {
    problemStates.set(stateKey(currentScenario(), competitionId, problemId), [])
  })

  // And what the next reload should find
  holdTranscripts()
}

/**
 * Reads one competition's problem set, with whatever the student has said about each.
 *
 * @param competitionId - Which competition's problems are being read.
 *
 * @returns The problems in the order the competition sets them, as the API would report it.
 */
export async function fetchCompetitionProblems(
  competitionId: string
): Promise<ApiResult<HostedCompetitionProblem[]>> {
  // Let the waiting states be seen
  await delay(RESPONSE_DELAY_MS)

  // The set, as the API would report it
  return { success: true, data: buildCompetitionProblems(competitionId) }
}

/**
 * Finds the transcripts held against one competition problem, wherever they are.
 *
 * @param competitionId - Which competition sets the problem.
 * @param problemId - Which problem they are about.
 *
 * @returns The sessions, which the caller may write through.
 */
function sessionsForTarget(competitionId: string, problemId: string): DefenseSession[] {
  // Which of the set it is, which is what decides whether it opens seeded
  const position = Number(problemId.slice(`${competitionId}-p`.length))

  // Whatever that problem holds
  return sessionsOf(competitionId, problemId, position)
}

/**
 * Reads the conversations a student holds against one competition problem.
 *
 * @param target - Which problem they are about.
 *
 * @returns The conversations and the caps they are held to, as the API would report it.
 */
export async function listCompetitionDefenseSessions(
  target: CompetitionDefenseTarget
): Promise<ApiResult<DefenseSessionList>> {
  // Let the waiting states be seen
  await delay(RESPONSE_DELAY_MS)

  // The conversations and the caps they are held to
  return {
    success: true,
    data: {
      sessions: sessionsForTarget(target.competitionId, target.problemId),
      limits: MOCK_LIMITS,
    },
  }
}

/**
 * Takes a student's turn and answers it, drawing the reply from {@link SCRIPTED_REPLIES}.
 *
 * @param request - The turn being sent, and the session it belongs to.
 *
 * @returns The conversation grown with the turn and its reply, as the API would report it.
 */
export async function submitCompetitionDefenseTurn(
  request: DefenseTurnRequest
): Promise<ApiResult<DefenseSession>> {
  // When the turn reached the backend. A candidate turn is stamped on arrival and never after the reply
  // has been generated: the entry's clock counts a turn by this stamp, so a stamp taken later spends the
  // examiner's thinking time out of the student's clock, and can put a turn sent with time left on it the
  // wrong side of the end
  const receivedAt = Date.now()

  // Think about it, so the thinking indicator is a state a reader actually meets
  await delay(RESPONSE_DELAY_MS)

  // The student stopped the turn while it was in flight, so nothing was ever said
  if (request.signal.aborted) {
    return { success: false, error: { message: 'Aborted' } }
  }

  // Where the conversation is, and which one it is
  const found = locateSession(request, receivedAt)

  // A session nobody can find is a failure the caller surfaces like any other
  if (found === null) {
    return { success: false, error: { message: 'Unknown defense session', statusCode: 404 } }
  }

  // The problem's transcripts, and the one being written into
  const { sessions, session } = found

  // How far in the student is
  const spent = session.turns.filter((turn) => turn.role === 'candidate').length

  // Which decides what the examiner says back
  const reply = SCRIPTED_REPLIES[spent % SCRIPTED_REPLIES.length]!

  // The conversation as it now stands
  const grown: DefenseSession = {
    ...session,
    turns: [
      ...session.turns,
      storedTurn('candidate', request.content, receivedAt),
      // Stamped where it was actually said, which is once there is a reply to say
      storedTurn('examiner', reply, Date.now()),
    ],
  }

  // Where it was being held, if it was
  const at = sessions.indexOf(session)

  // Write it back there, or park a conversation this turn opened at the front
  if (at === -1) {
    sessions.unshift(grown)
  } else {
    sessions[at] = grown
  }

  // And hold it for the next reload
  holdTranscripts()

  // The conversation as it now stands
  return { success: true, data: grown }
}

/**
 * Drops one conversation.
 *
 * @param sessionId - Which conversation to drop.
 *
 * @returns Nothing, as the API would report it.
 */
export async function deleteCompetitionDefenseSession(sessionId: string): Promise<ApiResult<void>> {
  // Let the pressed button hold its spinner
  await delay(RESPONSE_DELAY_MS)

  // Wherever it is being held
  for (const sessions of problemStates.values()) {
    // Where in this problem's transcripts it sits
    const at = sessions.findIndex((session) => session.id === sessionId)

    // Found, so drop it
    if (at !== -1) {
      sessions.splice(at, 1)

      // And hold what is left for the next reload
      holdTranscripts()

      // Nothing to report back
      return { success: true, data: undefined }
    }
  }

  // Nothing anywhere holds it, which the caller surfaces like any other failure
  return { success: false, error: { message: 'Unknown defense session', statusCode: 404 } }
}

/**
 * Refuses to truncate a competition conversation.
 *
 * The surface offers no rewind while a competition is on, so anything reaching here is a bug, and
 * answering it would quietly rewrite turns a grader is going to read.
 *
 * @returns Never returns, always throws.
 */
export function rewindCompetitionDefenseTurns(): Promise<never> {
  // Refused outright
  throw new Error('A competition conversation cannot be rewound')
}

/**
 * One conversation, together with the problem's own list of them that it belongs in.
 */
type LocatedSession = {
  /** Every conversation held about that problem, which the located one is written back into. */
  sessions: DefenseSession[]
  /** The conversation the turn belongs to. */
  session: DefenseSession
}

/**
 * Finds the conversation a turn belongs to, opening a new one when the turn is the first.
 *
 * @param request - The turn being sent.
 * @param receivedAt - When the turn reached the backend, in epoch milliseconds.
 *
 * @returns The problem's transcripts and the conversation within them, or null when neither exists.
 */
function locateSession(request: DefenseTurnRequest, receivedAt: number): LocatedSession | null {
  switch (request.kind) {
    // The first turn, which opens a conversation the backend mints
    case 'start': {
      // A handout target cannot reach this mock at all
      if (request.target.kind !== 'competition') {
        return null
      }

      // Where it will be kept
      const sessions = sessionsForTarget(request.target.competitionId, request.target.problemId)

      // The conversation, opening on the examiner's greeting, which the backend owns
      const session: DefenseSession = {
        id: mintId('session'),
        target: request.target,
        // The greeting is what the student answered, so it cannot land after their answer did
        turns: [storedTurn('examiner', OPENER, receivedAt - 1)],
        feedback: null,
        reports: [],
      }

      // Where it will be kept, and the conversation it opens
      return { sessions, session }
    }

    // A later turn, which lands in a conversation that already exists
    case 'continue': {
      // Wherever it is being held
      for (const sessions of problemStates.values()) {
        // The conversation, if this problem is the one holding it
        const session = sessions.find((candidate) => candidate.id === request.sessionId)

        // Found, so this is where the turn lands
        if (session !== undefined) {
          return { sessions, session }
        }
      }

      // Nothing anywhere holds it
      return null
    }

    // Every request is handled above
    default:
      return assertNever(request)
  }
}
