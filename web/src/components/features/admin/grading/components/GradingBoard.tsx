'use client'

import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { useEntryWindowLabel } from '@/components/features/hosted-competitions/hooks/use-entry-window-label'
import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'
import { useStepHotkeys } from '@/hooks/use-step-hotkeys'
import type { Locale } from '@/i18n/i18n'

import { useGradingBoard } from '../hooks/use-grading-board'
import {
  type BoardRow,
  type BoardSort,
  nextSort,
  rankOf,
  type SortBy,
} from '../model/grading-board'
import {
  formatScore,
  type Grade,
  type GradeSummary,
  type GradingCompetition,
  type GradingGroup,
  pairKey,
  scoreOf,
} from '../model/grading-types'
import { GradingModal } from './GradingModal'

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
            {/* Each competition, with how many entered it */}
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
          <p className="mt-3 text-xs text-muted sm:mt-4 sm:text-sm">
            {t.rich('progress', {
              graded: board.progress.graded,
              total: board.progress.total,
              final: board.progress.final,
              count: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })}
          </p>

          {/* Every student on every problem */}
          <GradingGrid
            competition={board.competition}
            rows={board.rows}
            grades={board.grades}
            sort={board.sort}
            onSort={board.sortBy}
            onOpen={board.selection.open}
          />

          {/* The pair being graded */}
          <GradingModal
            groupSlug={groupSlug}
            competition={board.competition}
            pairs={board.pairs}
            grades={board.grades}
            selection={board.selection}
            conversation={board.conversation}
            onSelectConversation={board.selectConversation}
          />
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
  /** The competition's rows, in the order asked for. */
  rows: BoardRow[]
  /** The competition's grades, by pair. */
  grades: ReadonlyMap<string, GradeSummary>
  /** How the rows are ordered. */
  sort: BoardSort
  /** Orders the rows by a column, or turns the current order round. */
  onSort: (by: SortBy) => void
  /** Opens a pair, by its key. */
  onOpen: (key: string) => void
}

/**
 * Students down the side, problems across the top, a total at the end.
 */
function GradingGrid({ competition, rows, grades, sort, onSort, onOpen }: GradingGridProps) {
  // Grading copy
  const t = useTranslations('admin.grading.grid')

  // A function which draws a header that orders the rows, lit while it is the one ordering them
  const sortHeader = (label: ReactNode, by: SortBy, className?: string, ariaLabel?: string) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onSort(by)}
      aria-pressed={sort.by === by}
      className={cn(
        'relative uppercase tracking-wide transition-colors hover:text-foreground',
        sort.by === by && 'text-foreground',
        className
      )}
    >
      {label}
      {/* Direction arrow, dimmed on a header not ordering the rows, where it points the way a click would
          order them. It hangs off the label's end so the label stays over its column */}
      <span
        className={cn(
          'absolute left-full top-1/2 ml-0.5 -translate-y-1/2',
          sort.by !== by && 'opacity-30'
        )}
      >
        {(sort.by === by ? sort.ascending : nextSort(sort, by).ascending) ? (
          <ArrowUp size={11} strokeWidth={2.5} aria-hidden />
        ) : (
          <ArrowDown size={11} strokeWidth={2.5} aria-hidden />
        )}
      </span>
    </button>
  )

  return (
    <div className="-mx-4 mt-3 overflow-x-auto bg-surface/30 sm:mx-0 sm:rounded-lg">
      <table className="w-full border-collapse text-xs hyphens-none sm:text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted sm:text-xs">
            <th className="w-px whitespace-nowrap py-2 pl-4 pr-1 text-right font-medium sm:pl-3">
              #
            </th>
            <th className="w-full whitespace-nowrap py-2 pl-2 pr-2 font-medium sm:px-3">
              {sortHeader(t('student'), 'name')}
            </th>
            {competition.problems.map((problem) => (
              <th key={problem.id} className="w-px px-0.5 py-2 text-center font-medium sm:px-2">
                {t('problem', { number: problem.number })}
              </th>
            ))}
            <th className="w-px whitespace-nowrap py-2 pl-2 pr-5 text-center text-sm font-medium normal-case sm:pl-3 sm:pr-6">
              {sortHeader(
                <abbr title={t('total')} className="no-underline">
                  Σ
                </abbr>,
                'total',
                'normal-case',
                t('total')
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user.id} className="border-t border-foreground/5">
              {/* Where they stand */}
              <td className="w-px whitespace-nowrap py-0.5 pl-4 pr-1 text-right tabular-nums text-muted sm:pl-3 sm:py-1.5">
                {rankOf(rows, row.total) ?? <span className="text-muted/50">–</span>}
              </td>

              {/* Who */}
              <th
                scope="row"
                className="w-full max-w-0 py-0.5 pl-2 pr-2 text-left font-medium text-foreground sm:px-3 sm:py-1.5"
              >
                <TruncatedText>{row.name}</TruncatedText>
              </th>

              {/* Each problem */}
              {competition.problems.map((problem) => {
                // The student's pair on this problem
                const key = pairKey(row.user.id, problem.id)

                // The student's summary on this problem, where the board holds one
                const summary = grades.get(key)

                return (
                  <td key={problem.id} className="w-px px-0.5 py-0.5 text-center sm:px-1 sm:py-1">
                    <GradeCell
                      conversationCount={summary?.conversationCount ?? 0}
                      grade={summary?.grade ?? null}
                      onOpen={() => onOpen(key)}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Props for the {@link GradeCell} component.
 */
type GradeCellProps = {
  /** How many conversations the student held about the problem. */
  conversationCount: number
  /** The grade given; null while none is. */
  grade: Grade | null
  /** Opens the pair. */
  onOpen: () => void
}

/**
 * One student on one problem: nothing to grade, waiting for a grade, pre-graded, or final.
 */
function GradeCell({ conversationCount, grade, onOpen }: GradeCellProps) {
  // Grading copy
  const t = useTranslations('admin.grading.grid')

  // Never discussed, so there is nothing to read and nothing to grade
  if (conversationCount === 0) return <span className="text-muted/50">–</span>

  // The score, while there is a mark to score
  const score = scoreOf(grade)

  return (
    <button
      type="button"
      onClick={onOpen}
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
