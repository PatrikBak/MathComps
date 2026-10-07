import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { describeUser } from '@/components/features/admin/model/user-identity'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useApiQuery } from '@/hooks/use-api-query'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'
import { useSteppedSelection, type UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { SidePanelId } from '../../conversation/hooks/use-conversation-panels'
import type { StudentProblem } from '../../conversation/hooks/use-student-conversations'
import { gradingBoardQueryKey } from '../../grades/hooks/grade-cache'
import { pairKey, splitPairKey } from '../../grades/model/grade-types'
import {
  type BoardRow,
  type BoardSort,
  buildRows,
  countProgress,
  type GradingProgress,
  indexGrades,
  nextSort,
  type SortBy,
  sortRows,
  walkOrder,
} from '../model/grading-board'
import {
  type GradeSummary,
  type GradingCompetition,
  type GradingGroup,
} from '../model/grading-types'
import { fromGradingQuery, toGradingQuery } from '../model/grading-url'
import { fetchGradingBoard } from '../services/grading-service'

/** Stands in for any map while there is no competition to fill it. */
const EMPTY_MAP = new Map<string, never>()

/**
 * What {@link useGradingBoard} hands back.
 */
type UseGradingBoardResult = {
  /** The group being graded; null until it has been read. */
  group: GradingGroup | null
  /** The group's competitions; empty until they have been read. */
  competitions: GradingCompetition[]
  /** How many students the group's competitions list, each counted once however many list them. */
  studentCount: number
  /** How reading the group's competitions is going. */
  uiState: QueryUiState
  /** The competition on screen; null while there is none. */
  competition: GradingCompetition | null
  /** Puts another competition on screen, by its category. */
  selectCategory: (category: HostedCompetitionCategory) => void
  /** The rows of the competition on screen, in the order asked for. */
  rows: BoardRow[]
  /** How the rows are ordered. */
  sort: BoardSort
  /** Orders the rows by a column, or turns the current order round. */
  sortBy: (by: SortBy) => void
  /** The grades of the competition on screen, by pair. */
  grades: ReadonlyMap<string, GradeSummary>
  /** How far grading the competition on screen has got. */
  progress: GradingProgress
  /** Which pair is open, and the walk through every pair with a conversation. */
  selection: UseSteppedSelectionResult
  /** The part the board's own address lands the pair it names on, while that pair is open; null otherwise. */
  landingTabId: SidePanelId | null
  /** The open pair's student and problem; null while none is open or no competition is on screen. */
  studentProblem: StudentProblem | null
}

/**
 * One group's grading board: its competitions, the one on screen laid out entrant by problem, and the walk
 * through every pair with a conversation.
 *
 * The address carries the category on screen and the open pair, so a reload lands back where the grader was and
 * a link can be sent to another. Whatever an address names that the board doesn't hold falls away once the board
 * arrives: a category the group doesn't run, and a pair the competition on screen doesn't walk.
 *
 * @param groupSlug - What addresses the group.
 *
 * @returns The board as described by {@link UseGradingBoardResult}.
 */
export function useGradingBoard(groupSlug: string): UseGradingBoardResult {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The group, its competitions, entrants and grades
  const { data, uiState } = useApiQuery({
    queryKey: gradingBoardQueryKey(groupSlug),
    fetch: (apiCall) => fetchGradingBoard(apiCall, groupSlug),
    // The board is an admin's own read, so it is made as them
    requireAuth: true,
    ...cachePolicy.userData,
  })

  // The group, once it has arrived
  const group = data ?? null

  // The competitions, none until they arrive
  const competitions = useMemo(() => data?.competitions ?? [], [data])

  // Everybody any competition lists, each once
  const studentCount = useMemo(
    () =>
      new Set(
        competitions.flatMap((candidate) => candidate.entrants.map((entrant) => entrant.user.id))
      ).size,
    [competitions]
  )

  // What the address was asking for when the board opened
  const initialAddress = useInitialUrlState(fromGradingQuery)

  // The category picked; null until one is
  const [selectedCategory, selectCategory] = useState(initialAddress.category)

  // The competition on screen: the one picked, else the first
  const competition =
    competitions.find((candidate) => candidate.category === selectedCategory) ??
    competitions[0] ??
    null

  // A category the group doesn't run falls away
  if (
    competition !== null &&
    selectedCategory !== null &&
    competition.category !== selectedCategory
  ) {
    // Back on the first
    selectCategory(null)
  }

  // How the rows are ordered, kept across competitions
  const [sort, setSort] = useState<BoardSort>({ by: 'name', ascending: true })

  // The competition's grades, by pair
  const grades = useMemo(
    () => (competition === null ? EMPTY_MAP : indexGrades(competition)),
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

  // The pair the address opened on, by its key; null where it named none
  const initialOpenKey =
    initialAddress.open === null
      ? null
      : pairKey(initialAddress.open.userId, initialAddress.open.problemId)

  // Which pair is open, and the walk from it
  const selection = useSteppedSelection(order, initialOpenKey)

  // A pair the competition on screen doesn't walk falls away
  if (competition !== null && selection.openId !== null && !order.includes(selection.openId)) {
    // Back to the board
    selection.close()
  }

  // The open pair's ids; null while none is open
  const open = selection.openId === null ? null : splitPairKey(selection.openId)

  // Keep the address saying what is on screen, so a reload comes back to it and it can be handed on
  useAddressSync(toGradingQuery({ category: selectedCategory, open }))

  // The open pair's student, among the entrants of the competition on screen; null while either is missing
  const openStudent =
    open === null
      ? null
      : (competition?.entrants.find((entrant) => entrant.user.id === open.userId)?.user ?? null)

  // The open pair as a student and a problem; null until both are known
  const studentProblem: StudentProblem | null =
    open === null || openStudent === null
      ? null
      : { user: openStudent, target: { kind: 'problem', problemId: open.problemId } }

  // A function which orders the rows by a column
  const sortBy = (by: SortBy) => setSort((current) => nextSort(current, by))

  // The rows in the order asked for
  const rows = sortRows(rowsByName, sort)

  // How far grading the competition has got
  const progress = countProgress(order, grades)

  // The part the board's own address lands the pair it names on, which holds only while that pair is open
  const landingTabId = selection.openId === initialOpenKey ? initialAddress.tab : null

  // The board, and every way of moving about it
  return {
    group,
    competitions,
    studentCount,
    uiState,
    competition,
    selectCategory,
    rows,
    sort,
    sortBy,
    grades,
    progress,
    selection,
    landingTabId,
    studentProblem,
  }
}
