import type { Page } from '@playwright/test'

import type {
  Grade,
  GradeChange,
  GradeDetail,
  GradingBoard,
} from '@/components/features/admin/grading/model/grading-types'

import { createAnswerGate } from './answer-gate'
import { BACKEND_ORIGIN } from './backend-routes'

/** The grader every grade the fake writes is stamped by. */
const GRADER = { id: 'grader', username: 'Grader', email: null }

/** A grade already given, pre-graded, before the page opens. */
const PRE_GRADED: Grade = {
  mark: 4,
  help: 0,
  internalComment: '',
  isFinal: false,
  updatedAt: '2026-09-27T09:00:00Z',
  updatedBy: GRADER,
}

/** What the fake's group is called, in English. */
export const GROUP_NAME = 'September round'

/**
 * The board the fake opens on: two competitions, the first with three students on two problems. Ada spoke about
 * her first problem twice and was pre-graded on her second, Bruno was graded final on his first and never spoke
 * about his second, and Cyril is not graded yet. The second competition holds Dora, who spoke about its problem
 * twice, and Ada again, who entered it too and never spoke about it, so four students made five entries.
 */
const BOARD: GradingBoard = {
  name: { sk: 'Septembrové kolo', cs: 'Zářijové kolo', en: GROUP_NAME },
  opensAt: '2026-09-01T00:00:00Z',
  closesAt: '2026-09-14T22:00:00Z',
  competitions: [
    {
      roundId: 'elementary-round',
      category: 'elementary',
      problems: [
        { id: 'p1', slug: 'elementary-1', number: 1 },
        { id: 'p2', slug: 'elementary-2', number: 2 },
      ],
      entrants: [
        { id: 'ada', username: 'Ada', email: null },
        { id: 'bruno', username: 'Bruno', email: null },
        { id: 'cyril', username: 'Cyril', email: null },
      ],
      grades: [
        { userId: 'ada', problemId: 'p1', conversationCount: 2, grade: null },
        { userId: 'ada', problemId: 'p2', conversationCount: 1, grade: PRE_GRADED },
        {
          userId: 'bruno',
          problemId: 'p1',
          conversationCount: 1,
          grade: { ...PRE_GRADED, mark: 6, isFinal: true },
        },
        { userId: 'bruno', problemId: 'p2', conversationCount: 0, grade: null },
        { userId: 'cyril', problemId: 'p1', conversationCount: 1, grade: null },
        { userId: 'cyril', problemId: 'p2', conversationCount: 1, grade: null },
      ],
    },
    {
      roundId: 'intermediate-round',
      category: 'intermediate',
      problems: [{ id: 'q1', slug: 'intermediate-1', number: 1 }],
      entrants: [
        { id: 'ada', username: 'Ada', email: null },
        { id: 'dora', username: 'Dora', email: null },
      ],
      grades: [
        { userId: 'ada', problemId: 'q1', conversationCount: 0, grade: null },
        { userId: 'dora', problemId: 'q1', conversationCount: 2, grade: null },
      ],
    },
  ],
}

/**
 * One change the page sent, and which grade it was sent to.
 */
type SentChange = {
  /** The student and problem, as `user|problem`. */
  pair: string
  /** What the page sent. */
  change: GradeChange
}

/**
 * The grading backend, held in memory, and what the page has asked of it.
 */
type GradingBackend = {
  /** Every change sent so far, oldest first. */
  changes: () => SentChange[]
  /** Keeps every change from here on waiting, until the function handed back lets them through. */
  hold: () => () => void
}

/**
 * What to vary about the fake.
 */
type GradingBackendOptions = {
  /** Which changes the backend refuses as leaving a grade invalid. Absent while every change is taken. */
  refuses?: (change: GradeChange) => boolean
}

/**
 * Lands a change on a grade the way the backend lands one it takes: a lowered mark pulls the help down with it
 * unless the change sets the help too, and taking the mark back clears the help and settles nothing. A change is
 * refused only where the fake's options say so.
 *
 * @param grade - The grade as it stands; null while none is given.
 * @param change - What the page sent.
 *
 * @returns The grade as it now stands; null while there still is none.
 */
function applyAsBackend(grade: Grade | null, change: GradeChange): Grade | null {
  // The mark the change leaves
  const mark = change.mark === undefined ? (grade?.mark ?? null) : change.mark.value

  // The help, pulled down under a lowered mark and cleared with a mark taken back
  const help = change.help ?? (mark === null ? 0 : Math.min(grade?.help ?? 0, mark))

  // The comment the change leaves
  const internalComment = change.internalComment ?? grade?.internalComment ?? ''

  // Whether it is final, which only ever stands beside a mark
  const isFinal = mark !== null && (change.isFinal ?? grade?.isFinal ?? false)

  // A change that leaves an ungraded student ungraded writes nothing
  if (grade === null && mark === null && internalComment === '') return null

  // The grade as it now stands
  return {
    mark,
    help,
    internalComment,
    isFinal,
    updatedAt: '2026-09-27T10:00:00Z',
    updatedBy: GRADER,
  }
}

/**
 * Builds everything one student's grade on one problem is read from.
 *
 * @param userId - The student.
 * @param problemId - The problem.
 * @param count - How many conversations they held about it.
 *
 * @returns The detail, each conversation's answer naming the student, problem and conversation it belongs to.
 */
function detailOf(userId: string, problemId: string, count: number): GradeDetail {
  // As many conversations as the student held, oldest first
  const conversations = Array.from({ length: count }, (_unused, index) => {
    // The conversation's id, naming the student, the problem and its place counting from 1
    const id = `${userId}-${problemId}-${index + 1}`

    // The conversation: an opener and one answer, the answer saying whose it is
    return {
      id,
      createdAt: `2026-09-2${index + 1}T10:00:00Z`,
      statement: `The statement of ${problemId}.`,
      reference: `The reference for ${problemId}.`,
      turns: [
        {
          id: `${id}-opener`,
          role: 'examiner' as const,
          content: 'Walk me through it.',
          createdAt: '2026-09-21T10:00:00Z',
        },
        {
          id: `${id}-answer`,
          role: 'candidate' as const,
          content: `Answer ${index + 1} by ${userId} on ${problemId}.`,
          createdAt: '2026-09-21T10:01:00Z',
        },
      ],
    }
  })

  // Ada said something about her first solution, and nobody else said anything
  const selfAssessment =
    userId === 'ada' && problemId === 'p1'
      ? // What she said
        { comment: 'I think it is complete.', updatedAt: '2026-09-21T11:00:00Z' }
      : // Nothing, from everyone else
        null

  // Everything the grade is read from
  return { conversations, selfAssessment }
}

/**
 * Stands in for the grading endpoints of one group: its board, each grade read in full, and each change.
 *
 * @param page - The page to intercept requests on.
 * @param groupSlug - The group the board is served for.
 * @param options - What to vary about the fake.
 *
 * @returns The backend, to watch and to hold.
 */
export async function installGradingBackend(
  page: Page,
  groupSlug: string,
  options: GradingBackendOptions = {}
): Promise<GradingBackend> {
  // The board as the backend holds it, written to by every change it takes
  const board = structuredClone(BOARD)

  // Every change sent, in the order it arrived
  const sent: SentChange[] = []

  // What a change waits at before it is answered
  const answers = createAnswerGate()

  // The board itself
  await page.route(`${BACKEND_ORIGIN}/admin/grading/groups/${groupSlug}`, (route) =>
    route.fulfill({ json: board })
  )

  // One grade, read in full or changed
  await page.route(`${BACKEND_ORIGIN}/admin/grading/problems/*/students/*`, async (route) => {
    // Which grade, named by the path's problem and student
    const segments = new URL(route.request().url()).pathname.split('/')
    const problemId = segments.at(-3) ?? ''
    const userId = segments.at(-1) ?? ''

    // Where the board holds it
    const summary = board.competitions
      .flatMap((competition) => competition.grades)
      .find((candidate) => candidate.userId === userId && candidate.problemId === problemId)

    // A grade the board doesn't hold, answered as not found
    if (summary === undefined) return route.fulfill({ status: 404 })

    // A read, answered whole
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: detailOf(userId, problemId, summary.conversationCount) })
    }

    // What the page sent
    const change = route.request().postDataJSON() as GradeChange

    // Recorded as it arrives, so a held change is still seen
    sent.push({ pair: `${userId}|${problemId}`, change })

    // Answered only once whatever holds it lets go
    await answers.passed()

    // A change the backend turns down leaves the grade as it was
    if (options.refuses?.(change) === true) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errorCode: 'HostedGradeValue' }),
      })
    }

    // Taken, the grade moved to where the change leaves it
    summary.grade = applyAsBackend(summary.grade, change)

    // Answered with where the grade now stands
    return summary.grade === null
      ? // Nothing, while there is still no grade
        route.fulfill({ status: 204 })
      : // The grade
        route.fulfill({ json: summary.grade })
  })

  // A function which snapshots the changes so far, so the list cannot grow underneath an assertion
  const changes = () => [...sent]

  // The backend, to watch and to hold
  return { changes, hold: answers.hold }
}
