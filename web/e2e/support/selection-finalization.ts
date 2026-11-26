import type { Locale } from '@/i18n/i18n'

import { GUID } from './backend-routes'
import {
  draftBoard,
  emptiedOnDrafts,
  type HeldSelection,
  refuseWith,
  SELECTION_API_PATH,
} from './selection-writes'

/** The path of a finalization: the board going into the rounds of the cycle it picks for. */
export const FINALIZATION_PATH = new RegExp(`^${SELECTION_API_PATH}/boards/(${GUID})/finalization$`)

/**
 * Every language a hosted round carries each problem in, written out rather than imported, so the fake keeps the
 * backend's rule whatever the app's own list does.
 */
const ROUND_LANGUAGES: Locale[] = ['sk', 'cs', 'en']

/**
 * Finalizes a draft into the rounds of the cycle it picks for, as the backend does. The board's held stage has to
 * say it is finalizable. Every slot has to be filled, and every slotted problem live, in the pool, and written and
 * solved in every language. Its problems then leave the pool and every other draft, and its slots stay as the
 * rounds now hold them. A slug another problem already carries is the one refusal the fake leaves out, holding
 * no slugs.
 *
 * @param held - What the backend holds.
 * @param boardId - The board.
 *
 * @returns What the backend holds afterwards.
 */
function finalize(held: HeldSelection, boardId: string): HeldSelection {
  // The board, which has to be a draft
  const board = draftBoard(held, boardId)

  // The cycle the board picks for, the board refused unless it can be finalized into it
  const cycle =
    board.cycle?.stage === 'finalizable' ? board.cycle : refuseWith('SelectionFinalizeBlocked')

  // Every slot filled
  if (board.papers.some((paper) => paper.slots.some((slot) => slot === null))) {
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

  // The board finalized into its cycle, whose rounds are still to open, its slots read off the rounds as they now
  // hold its problems
  const finalized = { ...board, cycle: { ...cycle, stage: 'finalized' as const } }

  // Every board, the finalized one in place of the draft and every other draft without its problems
  const boards = emptiedOnDrafts(
    held.boards.map((candidate) => (candidate.id === board.id ? finalized : candidate)),
    slotted
  )

  // The problems out of the pool, and the boards
  return {
    proposals: held.proposals.map((proposal) =>
      slotted.includes(proposal.id) ? { ...proposal, isUsed: true } : proposal
    ),
    boards,
  }
}

/**
 * A finalization, as the backend routes it: posted to the board's finalization address.
 *
 * @param held - What the backend holds.
 * @param method - The write's HTTP method.
 * @param boardId - The board.
 *
 * @returns What the backend holds afterwards.
 */
export function finalizationWrite(
  held: HeldSelection,
  method: string,
  boardId: string
): HeldSelection {
  // Nothing the app sends, so a fake that reaches here has drifted from the app
  if (method !== 'POST') throw new Error(`The backend routes no finalization as ${method}`)

  // The finalization
  return finalize(held, boardId)
}
