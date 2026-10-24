'use client'

import { ArrowDownUp, Check, CheckCheck } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRef } from 'react'

import { StudentDetails } from '@/components/features/hosted-competitions/components/StudentDetails'
import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { useEntryWindowLabel } from '@/components/features/hosted-competitions/hooks/use-entry-window-label'
import { formatScore } from '@/components/features/hosted-competitions/model/hosted-competition-score'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { SortHeader } from '@/components/shared/components/SortHeader'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { WaitingChangeButton } from '@/components/shared/components/WaitingChangeButton'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import type { TableSort } from '@/components/shared/utils/table-sort'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import { useResortableOrder } from '@/hooks/use-resortable-order'
import { useStepHotkeys } from '@/hooks/use-step-hotkeys'
import type { Locale } from '@/i18n/i18n'

import { AdminConversationDialog } from '../../conversation/components/AdminConversationDialog'
import { type Grade, pairKey, scoreOf } from '../../grades/model/grade-types'
import { type ColumnToFinalize, useColumnFinalizing } from '../hooks/use-column-finalizing'
import { useGradingBoard } from '../hooks/use-grading-board'
import { type EntrantRun, IS_STILL_SOLVING } from '../model/entrant-run'
import {
  type BoardRow,
  type ColumnFinality,
  columnFinality,
  rankOf,
  type SortBy,
  STARTS_ASCENDING,
} from '../model/grading-board'
import {
  type GradeSummary,
  type GradingCompetition,
  type GradingGroup,
  type GradingProblem,
} from '../model/grading-types'
import { RunMarker } from './RunMarker'

/**
 * Props for the {@link GradingBoard} component.
 */
type GradingBoardProps = {
  /** What addresses the group being graded. */
  groupSlug: string
}

/**
 * One group's grading board: pick a competition, see every student on every problem, open one to grade it.
 */
export function GradingBoard({ groupSlug }: GradingBoardProps) {
  // Grading copy
  const t = useTranslations('admin.grading')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // What each level is called
  const categoryName = useCategoryName()

  // The board and every way of moving about it
  const board = useGradingBoard(groupSlug)

  // Walking the pairs from the keyboard
  useStepHotkeys(board.selection)

  // The line over the grid
  const progressRef = useRef<HTMLParagraphElement>(null)

  // The rows, each held where it stood when their order was last set so nothing moves under the grader while the
  // board is read again, whether a change waits, the grid, and the way to show the latest rows from its top
  const { shown, isChangeWaiting, listRef, resortFromTop } = useResortableOrder({
    items: board.rows,
    keyOf: (row) => row.user.id,
    // The order set again as another competition comes on screen and as another order is asked for
    resetKey: JSON.stringify([board.competition?.roundId ?? null, board.sort]),
    // A student writing for the first time waits until the order is set again, unless the board has shown nobody
    // since it was set
    newcomerPlace: 'waiting',
    // The focus on the line over the grid as the way to show the latest rows leaves
    focusTarget: progressRef,
  })

  // Making a whole column final, once confirmed
  const finalizing = useColumnFinalizing()

  // The open student's run, while a student is open
  const openRun =
    board.studentProblem === null ? undefined : board.runs.get(board.studentProblem.user.id)

  // How many of the students whose marks the grader is asked to make final are still solving
  const stillSolving =
    finalizing.asking === null
      ? 0
      : finalizing.asking.column.userIds
          .map((userId) => board.runs.get(userId))
          .filter((run) => run !== undefined && IS_STILL_SOLVING[run.kind]).length

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* What this is */}
      <h1 className="text-xl font-bold text-foreground hyphens-none sm:text-2xl">{t('title')}</h1>
      <GroupSubtitle group={board.group} />

      {/* The board, or whatever stands in its place */}
      {board.competition === null ? (
        <FetchStatePlaceholder
          uiState={board.uiState}
          className="mt-10 flex flex-col items-center gap-2 text-center"
          empty={<p className="text-sm text-muted">{t('empty')}</p>}
          failed={<p className="text-sm text-muted">{t('loadFailed')}</p>}
        />
      ) : (
        <>
          {/* The competitions of the group */}
          <div className="mt-4 flex flex-wrap items-center gap-1 sm:mt-6 sm:gap-2">
            {/* Each competition, with how many students its board holds */}
            {board.competitions.map((candidate) => (
              <Button
                key={candidate.roundId}
                size="sm"
                shape="pill"
                className="min-h-7 gap-1 px-2.5 text-xs sm:min-h-9 sm:gap-2 sm:px-3 sm:text-sm"
                variant={candidate.roundId === board.competition?.roundId ? 'primary' : 'secondary'}
                aria-pressed={candidate.roundId === board.competition?.roundId}
                onClick={() => board.selectCategory(candidate.category)}
              >
                {categoryName(candidate.category)}
                <span className="text-[10px] text-muted sm:text-xs">
                  {candidate.entrants.length}
                </span>
              </Button>
            ))}

            {/* Students across every competition, each once */}
            <span className="ml-1 text-xs text-muted sm:ml-2 sm:text-sm">
              {tPlurals('students', { count: board.studentCount })}
            </span>
          </div>

          {/* How far it has got */}
          <p
            // Takes the focus as the way to show the latest rows leaves
            ref={progressRef}
            tabIndex={-1}
            // On a narrow screen, far enough above the grid for the button between them to cover neither
            className="mt-3 mb-5 text-xs text-muted focus:outline-none sm:mt-4 sm:text-sm md:mb-0"
          >
            {t.rich('progress', {
              graded: board.progress.graded,
              total: board.progress.total,
              final: board.progress.final,
              count: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })}
          </p>

          {/* The offer to show the rows as the latest read has them, once it moves them or brings a student */}
          <WaitingChangeButton
            label={t('showWhatsNew')}
            icon={ArrowDownUp}
            isWaiting={isChangeWaiting}
            onShow={resortFromTop}
            fallbackRef={progressRef}
          />

          {/* Every student on every problem */}
          <div ref={listRef}>
            <GradingGrid
              competition={board.competition}
              rows={shown}
              standings={board.rows}
              grades={board.grades}
              runs={board.runs}
              sort={board.sort}
              onSort={board.setSort}
              onOpen={board.selection.open}
              onFinalize={finalizing.ask}
            />
          </div>

          {/* The pair being graded */}
          <AdminConversationDialog
            selection={board.selection}
            studentProblem={board.studentProblem}
            authorMarker={openRun && <RunMarker run={openRun} />}
            initialTabId={board.landingTabId}
          />

          {/* The question before a column is made final */}
          {finalizing.asking !== null && (
            <ConfirmDialog
              isOpen
              onClose={finalizing.dismiss}
              onConfirm={finalizing.confirm}
              title={t('finalize.title', { number: finalizing.asking.problem.number })}
              message={
                <>
                  {t('finalize.message', {
                    number: finalizing.asking.problem.number,
                    count: finalizing.asking.column.userIds.length,
                    unmarked: finalizing.asking.column.unmarked,
                  })}
                  {stillSolving > 0 && (
                    <span className="mt-1 block">
                      {t('finalize.stillSolving', { count: stillSolving })}
                    </span>
                  )}
                </>
              }
              confirmText={t('finalize.confirm')}
              variant="default"
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Props for the {@link GroupSubtitle} component.
 */
type GroupSubtitleProps = {
  /** The group being graded; null until it has been read. */
  group: GradingGroup | null
}

/**
 * Which group is being graded, by its name and the days it took entries. The line stands empty while the group
 * loads, so the board under it doesn't jump when the name arrives.
 */
function GroupSubtitle({ group }: GroupSubtitleProps) {
  // Grading copy
  const t = useTranslations('admin.grading')

  // The language the group is named in
  const locale = useLocale() as Locale

  // Wording for the window a group takes entries in
  const entryWindowLabel = useEntryWindowLabel()

  // The days the group took entries, once it has arrived
  const entryWindow = group === null ? null : entryWindowLabel(group.opensAt, group.closesAt)

  return (
    <p className="mt-1 min-h-4 text-xs text-muted sm:min-h-5 sm:text-sm">
      {group !== null &&
        entryWindow !== null &&
        t('groupSubtitle', {
          name: group.name[locale],
          opens: entryWindow.opens,
          closes: entryWindow.closes,
        })}
    </p>
  )
}

/**
 * Props for the {@link GradingGrid} component.
 */
type GradingGridProps = {
  /** The competition. */
  competition: GradingCompetition
  /** The rows as they show, each where it stood when their order was last set. */
  rows: BoardRow[]
  /** Every row of the competition, shown yet or not, which the places are counted among. */
  standings: BoardRow[]
  /** The competition's grades, by pair. */
  grades: ReadonlyMap<string, GradeSummary>
  /** Where each of the competition's entrants stands on their own run, by user. */
  runs: ReadonlyMap<string, EntrantRun>
  /** Opens a pair, by its key. */
  onOpen: (key: string) => void
  /** Asks to make a problem's column final. */
  onFinalize: (column: ColumnToFinalize) => void
  /** How the rows are ordered. */
  sort: TableSort<SortBy>
  /** Orders the rows as asked. */
  onSort: (sort: TableSort<SortBy>) => void
}

/**
 * Students down the side, problems across the top, a total at the end, and a row under them for making a whole
 * problem's column final.
 */
function GradingGrid({
  competition,
  rows,
  standings,
  grades,
  runs,
  sort,
  onSort,
  onOpen,
  onFinalize,
}: GradingGridProps) {
  // Grading copy
  const t = useTranslations('admin.grading.grid')

  // Copy for where a student is from and in school
  const tDetails = useTranslations('competitions.studentDetails')

  return (
    <div className="-mx-4 mt-3 overflow-x-auto bg-surface/30 sm:mx-0 sm:rounded-lg">
      <table className="w-full border-collapse text-xs hyphens-none sm:text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted sm:text-xs">
            <SortHeader
              label="#"
              by="rank"
              sort={sort}
              startsAscending={STARTS_ASCENDING}
              onSort={onSort}
              className="w-px whitespace-nowrap py-2 pl-5 pr-1 text-right font-medium sm:pl-6"
              ariaLabel={t('rank')}
              arrowBefore
            />
            <SortHeader
              label={t('student')}
              by="name"
              sort={sort}
              startsAscending={STARTS_ASCENDING}
              onSort={onSort}
              className="w-full whitespace-nowrap py-2 pl-2 pr-2 font-medium sm:px-3"
            />
            <th className="w-px p-0 sm:py-2 sm:pr-3">
              <span className="sr-only">{tDetails('label')}</span>
            </th>
            {competition.problems.map((problem) => (
              <th key={problem.id} className="w-px px-0.5 py-2 text-center font-medium sm:px-2">
                {t('problem', { number: problem.number })}
              </th>
            ))}
            <SortHeader
              label={
                <abbr title={t('total')} className="no-underline">
                  Σ
                </abbr>
              }
              by="total"
              sort={sort}
              startsAscending={STARTS_ASCENDING}
              onSort={onSort}
              className="w-px whitespace-nowrap py-2 pl-2 pr-5 text-center text-sm font-medium normal-case sm:pl-3 sm:pr-6"
              ariaLabel={t('total')}
              buttonClassName="normal-case"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // Where the student stands on their own run
            const run = runs.get(row.user.id)

            // The student's row
            return (
              <tr key={row.user.id} className="border-t border-foreground/5">
                {/* Where they stand */}
                <td className="w-px whitespace-nowrap py-0.5 pl-5 pr-1 text-right tabular-nums text-muted sm:pl-6 sm:py-1.5">
                  {rankOf(standings, row) ?? <span className="text-muted/50">–</span>}
                </td>

                {/* Who, whether they may still write, and where they are from and in school on a phone */}
                <th
                  scope="row"
                  className="w-full max-w-0 py-0.5 pl-2 pr-2 text-left font-medium text-foreground sm:px-3 sm:py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <TruncatedText>{row.name}</TruncatedText>
                    </div>
                    {run !== undefined && <RunMarker run={run} />}
                  </div>
                  <div className="sm:hidden">
                    <StudentDetails student={row} />
                  </div>
                </th>

                {/* Where they are from and in school on a wide screen, a column of no width on a phone so the
                    footer spans the same columns at every width */}
                <td className="w-px whitespace-nowrap p-0 sm:py-1.5 sm:pr-3">
                  <div className="hidden sm:block">
                    <StudentDetails student={row} />
                  </div>
                </td>

                {/* Each problem */}
                {competition.problems.map((problem) => {
                  // The student's pair on this problem
                  const key = pairKey(row.user.id, problem.id)

                  // The student's summary on this problem, where the board holds one
                  const summary = grades.get(key)

                  // The student's cell on this problem
                  return (
                    <td key={problem.id} className="w-px px-0.5 py-0.5 text-center sm:px-1 sm:py-1">
                      <GradeCell
                        pairId={key}
                        conversationCount={summary?.conversationCount ?? 0}
                        grade={summary?.grade ?? null}
                        onOpen={onOpen}
                      />
                    </td>
                  )
                })}

                {/* The sum */}
                <td className="w-px whitespace-nowrap py-0.5 pl-2 pr-5 text-center tabular-nums sm:py-1.5 sm:pl-3 sm:pr-6">
                  {/* The number sits centred under Σ, and the final check hangs off it without moving it */}
                  <span className="relative inline-block">
                    {row.total === null ? (
                      <span className="text-muted/50">–</span>
                    ) : (
                      <span
                        className={
                          row.isFinal ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        }
                      >
                        {formatScore(row.total)}
                      </span>
                    )}
                    {row.isFinal && (
                      <Check
                        size={12}
                        strokeWidth={3}
                        className="absolute left-full top-1/2 ml-0.5 -translate-y-1/2 text-success"
                        aria-label={t('final')}
                      />
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/10">
            {/* What the row does, over the place, the name and the student's country and school year */}
            <td
              colSpan={3}
              className="py-1 pl-4 pr-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted sm:py-2 sm:px-3 sm:text-xs"
            >
              {t('makeFinal')}
            </td>

            {/* Each problem's column, named so focus can come back to it once it is made final */}
            {competition.problems.map((problem) => (
              <td
                key={problem.id}
                tabIndex={-1}
                {...OPEN_ID_ATTRIBUTE.stamp(problem.id)}
                className="w-px px-0.5 py-1 text-center sm:px-1 sm:py-2"
              >
                <FinalizeCell
                  problem={problem}
                  finality={columnFinality(competition, problem.id, grades)}
                  onFinalize={onFinalize}
                />
              </td>
            ))}

            {/* Nothing under the sum */}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * Props for the {@link FinalizeCell} component.
 */
type FinalizeCellProps = {
  /** The problem whose column this is. */
  problem: GradingProblem
  /** Where the column stands on being made final. */
  finality: ColumnFinality
  /** Asks to make a problem's column final. */
  onFinalize: (column: ColumnToFinalize) => void
}

/**
 * One problem's column, under its last pair: a button with how many marks it would make final, a check once every
 * pair in it is final, or a dash while it has no mark to make final.
 */
function FinalizeCell({ problem, finality, onFinalize }: FinalizeCellProps) {
  // Grading copy
  const t = useTranslations('admin.grading.grid')

  // Which state the column is in
  switch (finality.kind) {
    // Marks to make final
    case 'ready':
      return (
        <button
          type="button"
          onClick={() => onFinalize({ problem, column: finality })}
          aria-label={t('makeColumnFinal', {
            number: problem.number,
            count: finality.userIds.length,
          })}
          className={cn(
            'inline-flex min-h-6 min-w-7 items-center justify-center gap-1 rounded px-1 tabular-nums sm:min-h-8 sm:min-w-16 sm:rounded-md sm:px-2',
            'bg-foreground/5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground',
            FOCUS_RING_CLASS
          )}
        >
          {finality.userIds.length}
          <CheckCheck size={14} strokeWidth={2.5} className="hidden sm:block" aria-hidden />
        </button>
      )

    // Every pair final
    case 'done':
      return (
        <Check
          size={14}
          strokeWidth={3}
          className="inline-block text-success"
          aria-label={t('columnFinal', { number: problem.number })}
        />
      )

    // No mark to make final
    case 'idle':
      return <span className="text-muted/50">–</span>

    // Every state is handled above
    default:
      return assertNever(finality)
  }
}

/**
 * Props for the {@link GradeCell} component.
 */
type GradeCellProps = {
  /** The student and problem, by their pair key. */
  pairId: string
  /** How many conversations the student held about the problem. */
  conversationCount: number
  /** The grade given; null while none is. */
  grade: Grade | null
  /** Opens a pair, by its key. */
  onOpen: (key: string) => void
}

/**
 * One student on one problem: nothing to grade, waiting for a grade, pre-graded, or final.
 */
function GradeCell({ pairId, conversationCount, grade, onOpen }: GradeCellProps) {
  // Grading copy
  const t = useTranslations('admin.grading.grid')

  // Never discussed, so there is nothing to read and nothing to grade
  if (conversationCount === 0) return <span className="text-muted/50">–</span>

  // The score, while there is a mark to score
  const score = scoreOf(grade)

  return (
    <button
      type="button"
      onClick={() => onOpen(pairId)}
      // Named so closing the dialog can put focus back on whichever pair was last open
      {...OPEN_ID_ATTRIBUTE.stamp(pairId)}
      className={cn(
        'inline-flex min-h-6 min-w-7 items-center justify-center gap-1 rounded px-1 tabular-nums sm:min-h-8 sm:min-w-16 sm:rounded-md sm:px-2',
        'transition-colors hover:bg-foreground/10',
        score === null &&
          'text-muted outline-1 -outline-offset-1 outline-dashed outline-foreground/20',
        score !== null && grade?.isFinal !== true && 'text-muted-foreground',
        grade?.isFinal === true && 'font-semibold text-foreground'
      )}
    >
      {score === null ? '?' : formatScore(score)}
      {grade?.isFinal === true && (
        <Check size={14} strokeWidth={3} className="text-success" aria-label={t('final')} />
      )}
    </button>
  )
}
