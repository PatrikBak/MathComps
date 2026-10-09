import type { Locale } from '@/i18n/i18n'

import {
  draftBoard,
  emptiedOnDrafts,
  GUID,
  type HeldSelection,
  isGuid,
  readFields,
  refuseWith,
  takesBoard,
} from './selection-writes'

/** The path of a finalization: the board going into a cycle's rounds. */
export const FINALIZATION_PATH = new RegExp(`^/problem-selection/boards/(${GUID})/finalization$`)

/**
 * Every language a hosted round carries each problem in, written out rather than imported, so the fake keeps the
 * backend's rule whatever the app's own list does.
 */
const ROUND_LANGUAGES: Locale[] = ['sk', 'cs', 'en']

/**
 * Reads which cycle a finalization names, refusing a body that names none, as the backend does.
 *
 * @param body - The body as it went out; null when there was none.
 *
 * @returns The cycle's id.
 */
function readCycleId(body: string | null): string {
  // The cycle named, which has to be an id
  const { cycleId } = readFields(body)

  // Missing, null, or not an id, none of which names a cycle
  if (!isGuid(cycleId)) refuseWith('MalformedRequest')

  // The cycle's id
  return cycleId
}

/**
 * Finalizes a draft into a cycle's rounds, as the backend does. Its papers pair up one to one with the rounds by
 * category, every slot full and as many as a round takes, and every slotted problem live, in the pool, and written
 * and solved in every language. Its problems then leave the pool and every other draft, its slots stay as the
 * rounds now hold them, and the cycle's rounds are filled. A slug another problem already carries is the one
 * refusal the fake leaves out, holding no slugs.
 *
 * @param held - What the backend holds.
 * @param boardId - The board.
 * @param cycleId - The cycle.
 *
 * @returns What the backend holds afterwards.
 */
function finalize(held: HeldSelection, boardId: string, cycleId: string): HeldSelection {
  // The board, which has to be a draft
  const board = draftBoard(held, boardId)

  // The cycle, which has to exist
  const cycle =
    held.cycles.find((candidate) => candidate.id === cycleId) ??
    refuseWith('SelectionTargetNotFound')

  // A cycle that no longer takes a board has nothing to pair the papers with
  if (!takesBoard(cycle)) refuseWith('SelectionFinalizeBlocked')

  // The categories the papers fill, in one order
  const paperCategories = board.papers.map((paper) => paper.category ?? '').sort()

  // The categories the rounds run at, in the same order
  const roundCategories = [...cycle.categories].sort()

  // Every round at a category of its own, and the papers filling exactly those categories, one each
  if (
    new Set(roundCategories).size !== roundCategories.length ||
    paperCategories.join() !== roundCategories.join()
  ) {
    refuseWith('SelectionFinalizeBlocked')
  }

  // Every paper as long as a round, and every slot filled
  if (
    board.papers.some(
      (paper) =>
        paper.slots.length !== cycle.problemCount || paper.slots.some((slot) => slot === null)
    )
  ) {
    refuseWith('SelectionFinalizeBlocked')
  }

  // Every problem the papers hold
  const slotted = board.papers.flatMap((paper) => paper.slots.filter((slot) => slot !== null))

  // Their proposals, each of which has to be live and still in the pool
  const proposals = slotted.map(
    (problemId) =>
      held.proposals.find((proposal) => proposal.id === problemId && !proposal.isUsed) ??
      refuseWith('SelectionProposalUsed')
  )

  // And each written and solved in every language a round carries, a blank text counting as none
  if (
    proposals.some((proposal) =>
      ROUND_LANGUAGES.some((language) => {
        // The proposal's text in the language
        const text = proposal.texts[language]

        // Missing, or saying nothing in its statement or its solution
        return (
          text === undefined || text.statement.trim() === '' || (text.solution ?? '').trim() === ''
        )
      })
    )
  ) {
    refuseWith('SelectionProblemIncomplete')
  }

  // The board tied to the cycle, its slots read off the rounds as they now hold its problems
  const finalized = { ...board, finalization: { cycleName: cycle.name, opensAt: cycle.opensAt } }

  // Every board, the finalized one in place of the draft and every other draft without its problems
  const boards = emptiedOnDrafts(
    held.boards.map((candidate) => (candidate.id === board.id ? finalized : candidate)),
    slotted
  )

  // The problems out of the pool, the boards, and the cycle's rounds filled
  return {
    proposals: held.proposals.map((proposal) =>
      slotted.includes(proposal.id) ? { ...proposal, isUsed: true } : proposal
    ),
    boards,
    cycles: held.cycles.map((candidate) =>
      candidate.id === cycle.id ? { ...candidate, isFilled: true } : candidate
    ),
  }
}

/**
 * A finalization, as the backend routes it: posted to the board's finalization address. The body is read before
 * anything else, so a body the backend cannot read is refused first.
 *
 * @param held - What the backend holds.
 * @param method - The write's HTTP method.
 * @param boardId - The board.
 * @param body - The body as it went out; null when there was none.
 *
 * @returns What the backend holds afterwards.
 */
export function finalizationWrite(
  held: HeldSelection,
  method: string,
  boardId: string,
  body: string | null
): HeldSelection {
  // Nothing the app sends, so a fake that reaches here has drifted from the app
  if (method !== 'POST') throw new Error(`The backend routes no finalization as ${method}`)

  // The finalization
  return finalize(held, boardId, readCycleId(body))
}
