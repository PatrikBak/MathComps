import type { Page, Route } from '@playwright/test'

import type {
  DefenseCopy,
  DefenseSession,
  DefenseSessionList,
  MathildaConsent,
} from '@/components/features/defense/model/defense-types'
import type { SpentEntry } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { AppErrorCode } from '@/lib/api/api-error-codes'

import { BACKEND_ORIGIN } from './backend-routes'
import { HANDOUT_SESSION, LIMITS, OPENER, SCRIPTED_REPLIES } from './hosted-backend-content'
import {
  buildLibrary,
  buildProblems,
  competitionIn,
  type FakeState,
  forgetSession,
  groupOf,
  isSolutionOpen,
  problemIdOf,
  seedStraddlingDefense,
  storedTurn,
  transcriptsOf,
} from './hosted-backend-memory'
import {
  buildReadiness,
  buildView,
  CLOCK_MINUTES,
  COMPETITION_SLUG,
  type HostedState,
  PROBLEMS_PER_COMPETITION,
} from './hosted-backend-world'

/**
 * A backend for the competitions surface that answers out of memory instead of a database.
 *
 * The surface is one of the few the archive cannot stand in for: every state a student can be in is a row
 * somebody had to create, and reaching them for real means applying drafts, declaring a group and holding a
 * conversation with a live examiner that answers differently every run. Standing in for the API instead gives
 * each test the one state it is about, and makes the examiner's replies something an assertion can name.
 *
 * It holds real state rather than replaying fixtures: an entry taken in one call is there in the next read,
 * and a turn sent is in the transcript that comes back. That is what lets a test press a button and then
 * assert on what the page does with the answer, reloads included.
 */

// Re-exported so a spec reads them off the module it installs the fake from
export { COMPETITION_SLUG, LIMITS, OPENER }

/** {@link PROBLEMS_PER_COMPETITION}, as the specs read it. */
export const PROBLEM_COUNT = PROBLEMS_PER_COMPETITION

/**
 * How long the fake takes to answer, so the waiting states are the ones a reader actually sees.
 *
 * A test that needs to catch a spinner needs the spinner to exist for longer than the assertion takes to
 * arrive; one that does not is slowed by exactly this much per call, which is why it is small.
 */
const RESPONSE_DELAY_MS = 200

/**
 * The longest the runner waits for the page's clock to live through {@link RESPONSE_DELAY_MS}.
 *
 * A held clock is not walked forward by anything the fake does, so without this a spec that pauses and
 * then asserts would hang here rather than failing on the assertion it is about. It has to stay well
 * under the timeout the specs give their own assertions: a ceiling above that one answers the call
 * after the assertion it was holding up has already given up, and the failure then names a missing
 * divider rather than a reply that never came.
 */
const THINKING_CEILING_MS = 5_000

/**
 * How often the page's clock is read while a call is being held open.
 *
 * Each read is a round trip into the page, and so is the `fastForward` that ends the wait. Reading
 * every few milliseconds contends with it, and a paused clock then stays paused long enough for the
 * reply to miss its own assertion.
 */
const POLL_INTERVAL_MS = 200

/**
 * The refusals a drop can earn, each against the status the backend answers it with.
 */
const DROP_REFUSAL_STATUSES = {
  DefenseGradedSessionImmutable: 409,
  DefenseSessionNotFound: 404,
} as const satisfies Partial<Record<AppErrorCode, number>>

/** A refusal a drop can be answered with. */
type DropRefusal = keyof typeof DROP_REFUSAL_STATUSES

/**
 * What to vary about the student beyond the state they are in.
 */
export type HostedBackendOptions = {
  /**
   * Whether they have already been told what talking to Mathilda entails. Defaults to true, since every
   * spec about the chat needs to be past that gate to reach a composer at all.
   */
  hasConsented?: boolean

  /**
   * A note the student already left about their first solution in every competition, so a state whose entry
   * is long over still has one to read back. Absent while they have left none.
   */
  standingNote?: string

  /**
   * How the backend refuses every drop. Absent while drops are taken.
   */
  refuseDropWith?: DropRefusal
}

/**
 * What the page's own clock reads, which a spec holding it still has moved on from the runner's.
 *
 * Every instant stamped while a call is being answered has to come from here. A turn stamped off the
 * runner's clock lands before a buzzer the page has already walked past, and the transcript then reads
 * as though the reply beat a deadline it did not. What the fake lays out before it answers anything is
 * measured on the runner's clock, which is the only one there is at that point.
 *
 * @param page - The page whose clock to read.
 *
 * @returns The instant, in epoch milliseconds.
 */
async function pageNow(page: Page): Promise<number> {
  // The page's own clock, read inside it
  try {
    return await page.evaluate(() => Date.now())
  } catch {
    // A page mid-navigation has no clock to read, and the runner's is then the closest thing there is
    return Date.now()
  }
}

/**
 * Answers a route with a JSON body, after the delay every call takes.
 *
 * The delay is served by the page rather than the runner, so a spec that holds the clock still decides
 * when the answer lands: that window between a turn being sent and its reply arriving is exactly what
 * the specs about the buzzer are about.
 *
 * @param page - The page the call came from.
 * @param route - The call to answer.
 * @param body - What to answer with.
 */
async function answer(page: Page, route: Route, body: unknown): Promise<void> {
  // Take as long over the answer as every call takes
  await think(page)

  // Hand the body back
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/**
 * Holds a call open for as long as every call takes to answer, measured on the page's clock.
 *
 * Its own step because the two defense handlers stamp on both sides of it: the student's turn where it
 * reached the backend, the reply where the examiner finished writing it. Collapsing the two onto one
 * instant is what would let a turn sent with time to spare land the wrong side of the buzzer.
 *
 * It watches the page's clock rather than sleeping on a timer inside the page. A spec that pauses the
 * clock and then walks it forward is exactly the case these calls exist for, and an in-page timer
 * awaited from here never fires: the page is blocked on this very request, so the wait and the thing
 * that would end it are the same event loop. The real-time ceiling is what keeps a spec that pauses the
 * clock and never advances it from hanging here instead of failing on its own assertion.
 *
 * @param page - The page whose clock the wait runs on.
 */
async function think(page: Page): Promise<void> {
  // Where the page's clock stood when the call arrived
  const from = await pageNow(page)

  // And where the runner's clock stood, which is what bounds the wait
  const realFrom = Date.now()

  // Until the page has lived through the delay, or the runner has waited far longer than one
  while (Date.now() - realFrom < THINKING_CEILING_MS) {
    // Where the page's clock stands now, or the runner's when the page has gone away mid-call
    const now = await pageNow(page)

    // Long enough on the page's own clock
    if (now - from >= RESPONSE_DELAY_MS) {
      return
    }

    // Otherwise look again shortly, on the runner's clock, which nothing under test can hold
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

/**
 * What opening a conversation sends, in as much of it as the fake reads.
 */
type StartRequestBody = {
  /** The problem being argued. */
  target: { problemId: string }
  /** What the turn opening the argument says. */
  content: string
}

/**
 * What rewinding a conversation sends.
 */
type RewindRequestBody = {
  /** The sequence of the last turn to keep; every later one goes. */
  keepThroughSequence: number
}

/**
 * What a further turn in an open conversation sends.
 */
type TurnRequestBody = {
  /** What the turn says. */
  content: string
}

/**
 * Stands in for the whole competitions backend on one page.
 *
 * The competitions calls are answered from memory, as are the defense conversations and the student's
 * Mathilda consent. Anything else the surface reads is somebody else's stub to install.
 *
 * @param page - The page to intercept requests on.
 * @param initial - Which state the student is in when the page opens.
 * @param options - What to vary about the student outside the state they are in.
 */
export async function installHostedBackend(
  page: Page,
  initial: HostedState,
  options: HostedBackendOptions = {}
): Promise<void> {
  // What this page's backend holds, which its calls read and write
  const state: FakeState = {
    view: buildView(initial),
    readiness: buildReadiness(initial),
    transcripts: new Map(),
    assessments: new Map(),
    handoutSession: HANDOUT_SESSION,
    minted: 0,
  }

  // Whatever was already said inside an entry the state opens with
  for (const group of state.view.groups) {
    // Every competition that group runs
    for (const competition of group.competitions) {
      seedStraddlingDefense(state, group, competition)

      // And whatever the student already claimed of the first solution in it
      if (options.standingNote !== undefined) {
        state.assessments.set(problemIdOf(competition.slug.en, 1), options.standingNote)
      }
    }
  }

  // When the student acknowledged what talking to Mathilda entails, null while they have not
  let consentedAt: string | null = options.hasConsented === false ? null : new Date().toISOString()

  // The acknowledgement the chat is gated on: where the student stands, and the call that gives it
  await page.route(`${BACKEND_ORIGIN}/users/me/ai-consent`, async (route) => {
    // Giving consent, which the gate does and nothing else can
    if (route.request().method() === 'POST') {
      // Acknowledged where the page's clock stands
      consentedAt = new Date(await pageNow(page)).toISOString()

      // Answered with nothing to say
      await answer(page, route, {})

      // Done, since what follows answers the read
      return
    }

    // Where the student stands
    await answer(page, route, { consentedAt } satisfies MathildaConsent)
  })

  // The whole surface in one read
  await page.route(`${BACKEND_ORIGIN}/competitions`, (route) => answer(page, route, state.view))

  // What the student's account already holds
  await page.route(`${BACKEND_ORIGIN}/competitions/readiness`, (route) =>
    answer(page, route, state.readiness)
  )

  // Every call that spends or closes an entry, and the read that serves a spent one's problems
  await page.route(`${BACKEND_ORIGIN}/competitions/*/*`, async (route) => {
    // The address the call came in on
    const segments = new URL(route.request().url()).pathname.split('/')

    // Which of the competition's endpoints
    const endpoint = segments.pop() ?? ''

    // Which competition it names
    const competitionSlug = segments.pop() ?? ''

    // The competition being acted on
    const competition = competitionIn(state, competitionSlug)

    // One nobody can find is a failure the caller surfaces like any other
    if (competition === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to act on
      return
    }

    // What is being asked of that competition
    switch (endpoint) {
      // The clock starts now, and the call carries the acceptance with it
      case 'entry': {
        // The entry, started where the page's clock stands
        competition.entry = {
          kind: 'sat',
          startedAt: new Date(await pageNow(page)).toISOString(),
          finishedAt: null,
        }

        // Taking one is agreeing to the rules
        state.readiness.hasAcceptedRules = true

        // Answered with the entry and the problems it bought, which carry no solution: the clock has this
        // instant started
        await answer(page, route, {
          entry: competition.entry,
          problems: buildProblems(state, competition.slug.en, false),
        } satisfies SpentEntry)

        // Nothing else this call needs
        return
      }

      // Spent, and over in the same instant, so no clock ever runs
      case 'forfeit': {
        // The entry, given up where the page's clock stands
        competition.entry = {
          kind: 'forfeited',
          forfeitedAt: new Date(await pageNow(page)).toISOString(),
        }

        // Giving one up is agreeing to the rules just as taking it is
        state.readiness.hasAcceptedRules = true

        // Answered with the entry and the problems it bought, solutions and all: giving the entry up is
        // saying they are not competing here
        await answer(page, route, {
          entry: competition.entry,
          problems: buildProblems(state, competition.slug.en, true),
        } satisfies SpentEntry)

        // Nothing else this call needs
        return
      }

      // Over where the student said, and the clock they left on it goes with it
      case 'finish': {
        // The entry as it stands
        const entry = competition.entry

        // An entry can only be closed while the student is sitting it
        if (entry === null || entry.kind !== 'sat') {
          // Answered as a call for something that is not there
          await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

          // Nothing to close
          return
        }

        // Closed where the page's clock stands, unless it already carries a close
        competition.entry = {
          ...entry,
          finishedAt: entry.finishedAt ?? new Date(await pageNow(page)).toISOString(),
        }

        // Answered with the entry as it now stands
        await answer(page, route, competition.entry)

        // Nothing else this call needs
        return
      }

      // The one place an embargoed statement is served
      case 'problems': {
        // How long a clock in this competition's group runs
        const clockMinutes = groupOf(state, competitionSlug)?.clockMinutes ?? CLOCK_MINUTES

        // Answered with the competition's whole set, carrying the solutions where they are owed them
        await answer(
          page,
          route,
          buildProblems(
            state,
            competition.slug.en,
            isSolutionOpen(competition.entry, clockMinutes, await pageNow(page))
          )
        )

        // Nothing else this read needs
        return
      }

      // Nothing else lives under a competition, so the run names it rather than inventing an answer
      default: {
        await route.fallback()
      }
    }
  })

  // What the student left about one solution. Registered after the pattern above for the same reason the
  // dismissal below is
  await page.route(`${BACKEND_ORIGIN}/competitions/*/problems/*/assessment`, async (route) => {
    // Which problem is being claimed about
    const problemId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // Recording a note replaces whatever stood, and the delete drops it
    if (route.request().method() === 'PUT') {
      // What the student wrote
      const body = route.request().postDataJSON() as { comment: string }

      // Held as their one and only note about the problem
      state.assessments.set(problemId, body.comment)
    } else {
      // Nothing of theirs stands against it now
      state.assessments.delete(problemId)
    }

    // Nothing to hand back either way
    await route.fulfill({ status: 204, body: '' })
  })

  // The student asking not to be told about their unfinished profile again. Registered after the pattern
  // above, which would otherwise read "readiness" as a competition nobody can find: a later route is the
  // one Playwright tries first
  await page.route(`${BACKEND_ORIGIN}/competitions/readiness/dismissal`, async (route) => {
    // Only the write lives here
    if (route.request().method() !== 'POST') {
      // Passed on, so the run names it
      await route.fallback()

      // Nothing else answers on this path
      return
    }

    // Take their word for it, which is what the next readiness read will carry
    state.readiness.hasHiddenProfilePrompt = true

    // Nothing comes back
    await route.fulfill({ status: 204, body: '' })
  })

  // The examiner's canned lines, which the chat reads before it has anything else to show
  await page.route(`${BACKEND_ORIGIN}/defense/copy`, (route) =>
    answer(page, route, { opener: OPENER } satisfies DefenseCopy)
  )

  // The conversations held against one problem, and the caps a further one is held to
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/problems/*`, (route) => {
    // Which problem's conversations
    const problemId = new URL(route.request().url()).pathname.split('/').pop() ?? ''

    // Answered from memory, opening an empty transcript for a problem nobody has argued about
    return answer(page, route, {
      sessions: transcriptsOf(state, problemId),
      limits: LIMITS,
    } satisfies DefenseSessionList)
  })

  // Every conversation the student holds, across every problem, which is what the library lists
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/mine`, (route) =>
    answer(page, route, buildLibrary(state))
  )

  // Dropping a conversation, which the student may do with anything they are not graded on. The pattern
  // reaches the library read above too, so everything but the drop is passed back to it
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*`, async (route) => {
    // Only dropping a conversation lives here
    if (route.request().method() !== 'DELETE') {
      // Passed on, so the read it was meant for answers it
      await route.fallback()

      // What follows drops a conversation, which this call is not
      return
    }

    // Which conversation is being dropped
    const sessionId = new URL(route.request().url()).pathname.split('/').pop() ?? ''

    // A drop this backend refuses
    if (options.refuseDropWith !== undefined) {
      switch (options.refuseDropWith) {
        // One it cannot find is one the store no longer holds, so every list reading the same memory
        // has lost it already
        case 'DefenseSessionNotFound':
          forgetSession(state, sessionId)
          break

        // One it will not touch is still there for the next read to hand back
        case 'DefenseGradedSessionImmutable':
          break

        // Every refusal is answered above
        default:
          assertNever(options.refuseDropWith)
      }

      // The refusal, as the backend answers it
      await route.fulfill({
        status: DROP_REFUSAL_STATUSES[options.refuseDropWith],
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: options.refuseDropWith }),
      })

      // Nothing was dropped
      return
    }

    // Out of memory, so every list that reads it follows
    forgetSession(state, sessionId)

    // Answered with nothing, the way the backend answers a drop
    await route.fulfill({ status: 204, body: '' })
  })

  // Rewinding a conversation to a chosen turn, dropping everything said after it
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*/rewind`, async (route) => {
    // Which conversation is being rewound
    const sessionId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // How much of the conversation the student is keeping
    const { keepThroughSequence } = route.request().postDataJSON() as RewindRequestBody

    // Wherever it is being held
    const session = [...state.transcripts.values()]
      .flat()
      .find((candidate) => candidate.id === sessionId)

    // One nobody can find is a failure the caller surfaces like any other
    if (session === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to rewind
      return
    }

    // The cut point must land on an examiner turn, so the rewound conversation awaits the student. A client
    // that miscounts asks for a candidate one, which the site refuses
    if (session.turns[keepThroughSequence]?.role !== 'examiner') {
      // Answered as a rewind point that is not one
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: 'DefenseRewindTarget' }),
      })

      // Nothing is dropped on a cut point the conversation cannot take
      return
    }

    // The kept prefix, which is what every later read of the conversation comes back with
    session.turns = session.turns.slice(0, keepThroughSequence + 1)

    // Answered with nothing, the way the backend answers a rewind
    await route.fulfill({ status: 204, body: '' })
  })

  // Opening a conversation, which starts on the examiner's own line and answers the first turn
  await page.route(`${BACKEND_ORIGIN}/defense/sessions`, async (route) => {
    // Only opening a conversation lives here
    if (route.request().method() !== 'POST') {
      // Passed on, so the run names it
      await route.fallback()

      // What follows opens a conversation, which this call is not
      return
    }

    // What is being argued, and the turn opening the argument
    const body = route.request().postDataJSON() as StartRequestBody

    // When the turn reached the backend. The greeting belongs to the same instant: it is what the
    // conversation was opened on, so it cannot be stamped after the turn that asked for it.
    const receivedAt = await pageNow(page)

    // Take as long over the opening as every call takes
    await think(page)

    // A number no conversation before it took
    state.minted++

    // Opened on the examiner's line, then the student's turn, then her reply to it
    const session: DefenseSession = {
      id: `session-${state.minted}`,
      target: { kind: 'problem', problemId: body.target.problemId },
      turns: [
        storedTurn(state, 'examiner', OPENER, receivedAt),
        storedTurn(state, 'candidate', body.content, receivedAt + 1),
        // Stamped where it was actually said, which is once there is a reply to say
        storedTurn(state, 'examiner', SCRIPTED_REPLIES[0]!, await pageNow(page)),
      ],
      feedback: null,
      reports: [],
    }

    // Newest first, which is the order the rows are read in
    transcriptsOf(state, body.target.problemId).unshift(session)

    // Answered with the conversation as it now stands
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })

  // Every further turn in an open conversation
  await page.route(`${BACKEND_ORIGIN}/defense/sessions/*/turns`, async (route) => {
    // Which conversation the turn belongs to
    const sessionId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''

    // What the student just said
    const { content } = route.request().postDataJSON() as TurnRequestBody

    // Wherever it is being held
    const session = [...state.transcripts.values()]
      .flat()
      .find((candidate) => candidate.id === sessionId)

    // One nobody can find is a failure the caller surfaces like any other
    if (session === undefined) {
      // Answered as a call for something that is not there
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })

      // Nothing to add a turn to
      return
    }

    // When the turn reached the backend. The entry's clock counts a turn by this stamp, so one taken
    // after the reply was written would spend the examiner's thinking time out of the student's clock.
    const receivedAt = await pageNow(page)

    // Take as long over the turn as every call takes
    await think(page)

    // How many the student has spent, which is what picks the reply
    const spent = session.turns.filter((turn) => turn.role === 'candidate').length

    // The turn where it landed, and the reply where it was actually said
    session.turns.push(
      storedTurn(state, 'candidate', content, receivedAt),
      storedTurn(
        state,
        'examiner',
        SCRIPTED_REPLIES[spent % SCRIPTED_REPLIES.length]!,
        await pageNow(page)
      )
    )

    // Answered with the conversation as it now stands
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })
}
