import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { describeUser } from '@/components/features/admin/model/user-identity'
import { useApiQuery } from '@/hooks/use-api-query'
import { useSteppedSelection, type UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import {
  type BoardRow,
  type BoardSort,
  buildRows,
  countProgress,
  type GradingProgress,
  indexGrades,
  indexPairs,
  nextSort,
  type SortBy,
  sortRows,
  walkOrder,
} from '../model/grading-board'
import type { GradeSummary, GradingCompetition, GradingPair } from '../model/grading-types'
import { fetchGradingBoard } from '../services/grading-service'
import { gradingBoardQueryKey } from './grading-cache'

/** Stands in for any map while there is no competition to fill it. */
const EMPTY_MAP = new Map<string, never>()

/**
 * What {@link useGradingBoard} hands back.
 */
type UseGradingBoardResult = {
  /** The group's competitions; empty until they have been read. */
  competitions: GradingCompetition[]
  /** How reading the group's competitions is going. */
  uiState: QueryUiState
  /** The competition on screen; null while there is none. */
  competition: GradingCompetition | null
  /** Puts another competition on screen, by its round. */
  selectCompetition: (roundId: string) => void
  /** The rows of the competition on screen, in the order asked for. */
  rows: BoardRow[]
  /** How the rows are ordered. */
  sort: BoardSort
  /** Orders the rows by a column, or turns the current order round. */
  sortBy: (by: SortBy) => void
  /** The grades of the competition on screen, by pair. */
  grades: ReadonlyMap<string, GradeSummary>
  /** Each entrant of the competition on screen on each of its problems, by pair. */
  pairs: ReadonlyMap<string, GradingPair>
  /** How far grading the competition on screen has got. */
  progress: GradingProgress
  /** Which pair is open, and the walk through every pair with a conversation. */
  selection: UseSteppedSelectionResult
}

/**
 * One group's grading board: its competitions, the one on screen laid out entrant by problem, and the walk
 * through every pair with a conversation.
 *
 * @param groupSlug - What addresses the group.
 *
 * @returns The board as described by {@link UseGradingBoardResult}.
 */
export function useGradingBoard(groupSlug: string): UseGradingBoardResult {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The group's competitions, entrants and grades
  const { data, uiState } = useApiQuery({
    queryKey: gradingBoardQueryKey(groupSlug),
    fetch: (apiCall) => fetchGradingBoard(apiCall, groupSlug),
    // The board is an admin's own read, so it is made as them
    requireAuth: true,
    ...cachePolicy.userData,
  })

  // The competitions, none until they arrive
  const competitions = useMemo(() => data ?? [], [data])

  // The round picked; null until one is
  const [selectedRoundId, selectCompetition] = useState<string | null>(null)

  // The competition on screen: the one picked, else the first
  const competition =
    competitions.find((candidate) => candidate.roundId === selectedRoundId) ??
    competitions[0] ??
    null

  // How the rows are ordered, kept across competitions
  const [sort, setSort] = useState<BoardSort>({ by: 'name', ascending: true })

  // The competition's grades, by pair
  const grades = useMemo(
    () => (competition === null ? EMPTY_MAP : indexGrades(competition)),
    [competition]
  )

  // The competition's entrants on its problems, by pair
  const pairs = useMemo(
    () => (competition === null ? EMPTY_MAP : indexPairs(competition)),
    [competition]
  )

  // The competition's rows, by name
  const rowsByName = useMemo(
    () =>
      competition === null
        ? []
        : buildRows(competition, grades, (user) => describeUser(user, tProfile('defaultUser'))),
    [competition, grades, tProfile]
  )

  // The walk through every pair with a conversation
  const order = useMemo(
    () => (competition === null ? [] : walkOrder(competition, rowsByName, grades)),
    [competition, rowsByName, grades]
  )

  // Which pair is open, and the walk from it
  const selection = useSteppedSelection(order, null)

  // A function which orders the rows by a column
  const sortBy = (by: SortBy) => setSort((current) => nextSort(current, by))

  // The rows in the order asked for
  const rows = sortRows(rowsByName, sort)

  // How far grading the competition has got
  const progress = countProgress(order, grades)

  // The board, and every way of moving about it
  return {
    competitions,
    uiState,
    competition,
    selectCompetition,
    rows,
    sort,
    sortBy,
    grades,
    pairs,
    progress,
    selection,
  }
}
