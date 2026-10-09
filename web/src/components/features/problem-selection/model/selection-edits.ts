import type {
  Board,
  MoveWrite,
  Paper,
  PlacementWrite,
  SelectionData,
  SlotAddress,
  SlotDirection,
} from './selection-types'

/** How far a move takes a slot: up is the slot before it, down the slot after. */
export const MOVE_STEP: Record<SlotDirection, number> = { up: -1, down: 1 }

/**
 * Every slot of a board run through one function.
 *
 * @param board - The board.
 * @param map - What each slot holds afterwards, given its paper, what it holds now and its position.
 *
 * @returns The board with its slots replaced.
 */
function mapSlots(
  board: Board,
  map: (paper: Paper, held: string | null, index: number) => string | null
): Board {
  // The board with every paper's slots run through map
  return {
    ...board,
    papers: board.papers.map((paper) => ({
      ...paper,
      slots: paper.slots.map((held, index) => map(paper, held, index)),
    })),
  }
}

/**
 * One board of the selection replaced, every other one left as it was.
 *
 * @param data - The selection.
 * @param boardId - The board.
 * @param edit - The board as it stands afterwards.
 *
 * @returns The selection with that board replaced.
 */
function editBoard(
  data: SelectionData,
  boardId: string,
  edit: (board: Board) => Board
): SelectionData {
  // The selection with the board of that id swapped for its edit
  return {
    ...data,
    boards: data.boards.map((board) => (board.id === boardId ? edit(board) : board)),
  }
}

/**
 * The selection once a proposal is put into a draft's slot. A proposal already on the same board trades places
 * with whatever held the slot, and nothing else moves. One coming from the pool takes the slot, and the slot's old
 * problem comes off this board, keeping its place on any other.
 *
 * @param data - The selection.
 * @param placement - The proposal and the slot it goes into.
 *
 * @returns The selection as the placement leaves it.
 */
export function afterPlacement(
  data: SelectionData,
  { slot, proposalId }: PlacementWrite
): SelectionData {
  // The board taking the proposal, with the newcomer in the slot and the occupant wherever the newcomer stood
  return editBoard(data, slot.boardId, (board) => {
    // What the slot holds now
    const occupant =
      board.papers.find((paper) => paper.id === slot.paperId)?.slots[slot.index] ?? null

    // Every slot of the board, the two the placement touches changed
    return mapSlots(board, (paper, held, index) => {
      // The slot itself takes the newcomer
      if (paper.id === slot.paperId && index === slot.index) return proposalId

      // Where the newcomer stood takes the occupant, which happens only on a trade
      if (held === proposalId) return occupant

      // Every other slot stays put
      return held
    })
  })
}

/**
 * The selection once a slot is emptied, its problem going back to the pool. Only that slot changes, so the
 * problem keeps its place on any other board.
 *
 * @param data - The selection.
 * @param slot - The slot.
 *
 * @returns The selection as the clearing leaves it.
 */
export function afterClearing(data: SelectionData, slot: SlotAddress): SelectionData {
  // The selection with the slot standing empty
  return editBoard(data, slot.boardId, (board) =>
    mapSlots(board, (paper, held, index) =>
      paper.id === slot.paperId && index === slot.index ? null : held
    )
  )
}

/**
 * The selection once a slot trades places with its neighbour in the same paper.
 *
 * @param data - The selection.
 * @param move - The slot and the neighbour it trades with.
 *
 * @returns The selection as the move leaves it, unchanged when there is no neighbour that way.
 */
export function afterMove(data: SelectionData, { slot, direction }: MoveWrite): SelectionData {
  // The neighbour's position
  const neighbour = slot.index + MOVE_STEP[direction]

  // The selection with the slot traded with its neighbour, if it has one that way
  return editBoard(data, slot.boardId, (board) => ({
    ...board,
    papers: board.papers.map((paper) => {
      // Whether the paper has a slot at the neighbour's position
      const hasNeighbour = neighbour >= 0 && neighbour < paper.slots.length

      // Only the slot's own paper moves, and only when the neighbour exists
      if (paper.id !== slot.paperId || !hasNeighbour) return paper

      // The paper's slots with the slot and its neighbour traded
      const slots = [...paper.slots]
      ;[slots[slot.index], slots[neighbour]] = [slots[neighbour], slots[slot.index]]

      // The paper holding the traded slots
      return { ...paper, slots }
    }),
  }))
}
