'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { formatScore } from '@/components/features/admin/grades/model/grade-types'
import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { AppLink } from '@/components/shared/components/AppLink'
import { Button } from '@/components/shared/components/Button'
import { CountryFlag } from '@/components/shared/components/CountryFlag'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { Modal } from '@/components/shared/components/Modal'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import type { AddressedDisclosure } from '@/hooks/use-addressed-disclosure'
import type { Locale } from '@/i18n/i18n'

import { useCategoryName } from '../hooks/use-category-name'
import { useCompetitionResults } from '../hooks/use-competition-results'
import { useEntryReader } from '../hooks/use-entry-reader'
import { useHostedCompetitionsView } from '../hooks/use-hosted-competitions-view'
import {
  areResultsComplete,
  findCompetitionInGroup,
  resultTotal,
} from '../model/hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionGroup,
  ResultCell,
  ResultRow,
  ResultStudent,
  SchoolGrade,
} from '../model/hosted-competition-types'
import { competitionAreaHref } from '../services/hosted-competition-routes'

/**
 * Props for the {@link CompetitionResultsModal}.
 */
type CompetitionResultsModalProps = {
  /** Which competition's results are open, by any of its slugs, and the ways to change that. */
  disclosure: AddressedDisclosure
}

/**
 * Whichever competition's results are open, drawn over the page.
 */
export function CompetitionResultsModal({ disclosure }: CompetitionResultsModalProps) {
  // Who is reading
  const { readerKey, isReaderKnown } = useEntryReader()

  // Every group the page already holds
  const { view } = useHostedCompetitionsView(readerKey, isReaderKnown)

  // Nothing open, nothing to draw
  if (disclosure.openedValue === null) return null

  // The open competition, with the group it runs in
  const found = findCompetitionInGroup(view, disclosure.openedValue)

  // A name no group answers to draws nothing either
  if (found === undefined) return null

  // The results of the one that is open
  return (
    <CompetitionResultsDialog
      group={found.group}
      competition={found.competition}
      onSelect={disclosure.open}
      onClose={disclosure.close}
    />
  )
}

/**
 * Props for the {@link CompetitionResultsDialog}.
 */
type CompetitionResultsDialogProps = {
  /** The group the competition runs in. */
  group: HostedCompetitionGroup
  /** The competition showing. */
  competition: HostedCompetition
  /** Shows another of the group's competitions. */
  onSelect: (competitionSlug: string) => void
  /** Closes the results. */
  onClose: () => void
}

/**
 * One group's results, a competition at a time: everybody who sat it, where they stand and what they scored
 * on each problem.
 */
function CompetitionResultsDialog({
  group,
  competition,
  onSelect,
  onClose,
}: CompetitionResultsDialogProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // What each level is called
  const categoryName = useCategoryName()

  // The language the group and its slugs are read in
  const locale = useLocale() as Locale

  // The competition's results
  const { results, uiState } = useCompetitionResults(competition.slug[locale])

  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton
      align="top"
      className="hyphens-none sm:max-w-3xl"
      title={
        <span className="flex items-baseline gap-2">
          {t('title')}
          <span className="text-sm font-normal text-muted">{group.name[locale]}</span>
        </span>
      }
    >
      {/* The group's competitions, one at a time, where it holds more than one to pick between */}
      {group.competitions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {group.competitions.map((candidate) => (
            <Button
              key={candidate.slug[locale]}
              size="sm"
              shape="pill"
              className="min-h-7 px-2.5 text-xs sm:min-h-9 sm:px-3 sm:text-sm"
              variant={candidate === competition ? 'primary' : 'secondary'}
              aria-pressed={candidate === competition}
              onClick={() => onSelect(candidate.slug[locale])}
            >
              {candidate.category === null ? '' : categoryName(candidate.category)}
            </Button>
          ))}
        </div>
      )}

      {/* The results, or whatever stands in their place */}
      {results === undefined || results.rows.length === 0 ? (
        <FetchStatePlaceholder
          uiState={results === undefined ? uiState : { kind: 'ready' }}
          className="flex flex-col items-center gap-2 py-12 text-center"
          empty={<p className="text-sm text-muted">{t('empty')}</p>}
          failed={<p className="text-sm text-muted">{t('loadFailed')}</p>}
        />
      ) : (
        <>
          {/* That the order can still move */}
          {!areResultsComplete(results.rows) && (
            <p className="mt-3 text-xs text-muted sm:text-sm">{t('preliminary')}</p>
          )}

          {/* Everybody's row */}
          <ResultsGrid
            rows={results.rows}
            ownHref={competitionAreaHref(competition.slug[locale])}
          />
        </>
      )}
    </Modal>
  )
}

/**
 * Props for the {@link ResultsGrid}.
 */
type ResultsGridProps = {
  /** Every row, in standing order. */
  rows: ResultRow[]
  /** Where the reader's own row leads: their own work. */
  ownHref: ReturnType<typeof competitionAreaHref>
}

/**
 * Students down the side, problems across the top, the total at the end.
 */
function ResultsGrid({ rows, ownHref }: ResultsGridProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // How many problems the set holds
  const problemCount = rows[0]?.cells.length ?? 0

  return (
    <div className="-mx-3 mt-3 overflow-x-auto sm:mx-0">
      <table className="w-full border-collapse text-xs hyphens-none sm:text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted sm:text-xs">
            <th className="w-px whitespace-nowrap py-2 pl-2 pr-1 text-right font-medium sm:pl-3">
              <abbr title={t('place')} className="no-underline">
                #
              </abbr>
            </th>
            <th className="w-full py-2 pl-1.5 pr-1 font-medium sm:px-3">{t('student')}</th>
            <th className="hidden w-px py-2 pr-3 sm:table-cell">
              <span className="sr-only">{t('details')}</span>
            </th>
            {Array.from({ length: problemCount }, (_unused, index) => (
              <th key={index} className="w-px px-0 py-2 text-center font-medium">
                <span className="inline-block w-8 min-[375px]:w-9 sm:w-12">
                  {t('problem', { number: index + 1 })}
                </span>
              </th>
            ))}
            <th className="w-px whitespace-nowrap py-2 pl-2 pr-3 text-center text-sm font-medium normal-case sm:pl-3 sm:pr-5">
              <abbr title={t('total')} className="no-underline">
                Σ
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // The row's sum
            const total = resultTotal(row.cells)

            return (
              <tr
                key={index}
                className={cn('border-t border-foreground/5', row.isReader && 'bg-brand/10')}
              >
                {/* Where they stand */}
                <td className="w-px whitespace-nowrap py-1 pl-2 pr-1 text-right tabular-nums text-muted sm:pl-3 sm:py-1.5">
                  {row.place ?? <span className="text-muted/50">–</span>}
                </td>

                {/* Who */}
                <th
                  scope="row"
                  className="w-full max-w-0 py-1 pl-1.5 pr-1 text-left font-medium sm:px-3 sm:py-1.5"
                >
                  <StudentLabel student={row.student} isReader={row.isReader} ownHref={ownHref} />
                </th>

                {/* Where they are from and where they are in school, under the name on a phone */}
                <td className="hidden w-px whitespace-nowrap py-1.5 pr-3 sm:table-cell">
                  <StudentDetails student={row.student} />
                </td>

                {/* Each problem, in columns of one width so neighbouring scores never run together */}
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="w-px px-0 py-1 text-center sm:py-1.5">
                    <span className="inline-flex w-8 justify-center min-[375px]:w-9 sm:w-12">
                      <CellValue cell={cell} />
                    </span>
                  </td>
                ))}

                {/* The sum */}
                <td className="w-px whitespace-nowrap py-1 pl-2 pr-3 text-center tabular-nums sm:py-1.5 sm:pl-3 sm:pr-5">
                  {total === null ? (
                    <span className="text-muted/50">–</span>
                  ) : (
                    <span className="font-semibold text-foreground">{formatScore(total)}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Props for the {@link StudentLabel}.
 */
type StudentLabelProps = {
  /** Who. */
  student: ResultStudent
  /** Whether it is the reader. */
  isReader: boolean
  /** Where the reader's own name leads. */
  ownHref: ReturnType<typeof competitionAreaHref>
}

/**
 * A student as the results name them: avatar and username, with their details under the name on a phone,
 * where a column of their own would leave the name a couple of letters.
 */
function StudentLabel({ student, isReader, ownHref }: StudentLabelProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // Profile copy
  const tProfile = useTranslations('profile')

  // The username, or a stand-in for an account since deleted
  const name = student.username ?? tProfile('defaultUser')

  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* The avatar */}
      <UserAvatarImage imageUrl={student.avatarUrl} altText="" size={22} className="ring-1" />

      {/* The name, and the details under it on a phone */}
      <span className="flex min-w-0 flex-col">
        <span className="min-w-0 leading-tight text-foreground">
          {isReader ? (
            <AppLink href={ownHref} plain className="text-link">
              <TruncatedText>{name}</TruncatedText>
            </AppLink>
          ) : (
            <TruncatedText>{name}</TruncatedText>
          )}
        </span>

        {isReader && <span className="sr-only">({t('you')})</span>}

        <span className="sm:hidden">
          <StudentDetails student={student} />
        </span>
      </span>
    </span>
  )
}

/**
 * Props for the {@link StudentDetails}.
 */
type StudentDetailsProps = {
  /** Who. */
  student: ResultStudent
}

/**
 * Where a student competes from and where they are in school: a flag and a few words.
 */
function StudentDetails({ student }: StudentDetailsProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // The language countries are named in
  const locale = useLocale() as Locale

  // What countries are called here
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {student.countryCode !== null && (
        <CountryFlag
          code={student.countryCode}
          name={regionNames.of(student.countryCode) ?? student.countryCode}
          width={14}
          height={10}
          className="shrink-0 rounded-[2px]"
        />
      )}

      <span className="min-w-0 truncate text-[10px] font-normal text-muted sm:text-xs">
        {schoolGradeWords(student.grade, t)}
      </span>
    </span>
  )
}

/**
 * Where a student is in school, in words.
 *
 * @param grade - Where they are.
 * @param t - Results copy.
 *
 * @returns The words.
 */
function schoolGradeWords(
  grade: SchoolGrade,
  t: ReturnType<typeof useTranslations<'competitions.resultsView'>>
): string {
  // The words for each kind of school year
  switch (grade.kind) {
    // A year of primary school
    case 'primarySchool':
      return t('primarySchoolGrade', { year: grade.year })

    // A year of high school
    case 'highSchool':
      return t('highSchoolGrade', { year: grade.year })

    // Done with high school
    case 'pastHighSchool':
      return t('pastHighSchool')

    // Every grade is handled above
    default:
      return assertNever(grade)
  }
}

/**
 * Props for the {@link CellValue}.
 */
type CellValueProps = {
  /** One student on one problem. */
  cell: ResultCell
}

/**
 * One student on one problem: a score, a mark still to come, or nothing to mark.
 */
function CellValue({ cell }: CellValueProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // What the cell shows, by where marking the problem stands
  switch (cell.kind) {
    // Nothing written, so nothing to mark
    case 'none':
      return (
        <span className="text-muted/50" title={t('noneCell')}>
          –
        </span>
      )

    // Written, and still being marked
    case 'pending':
      return (
        <span
          className="inline-flex min-h-6 min-w-7 items-center justify-center rounded px-1 text-muted outline-1 -outline-offset-1 outline-dashed outline-foreground/20 sm:min-w-9"
          title={t('pendingCell')}
        >
          ?
        </span>
      )

    // Marked for good
    case 'scored':
      return (
        <span className="font-semibold tabular-nums text-foreground">
          {formatScore(cell.score)}
        </span>
      )

    // Every cell is handled above
    default:
      return assertNever(cell)
  }
}

/**
 * Props for the {@link MarkingLabel}.
 */
type MarkingLabelProps = {
  /** The student's own cells, one per problem. */
  cells: ResultCell[]
}

/**
 * Where marking a student's own work stands, as their row on the list says it: nothing in yet, some of it, or
 * all of it. Only the problems they wrote about count, the others having nothing to mark, and a student who
 * wrote about none gets nothing.
 */
export function MarkingLabel({ cells }: MarkingLabelProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The problems there is anything to mark on
  const toMark = cells.filter((cell) => cell.kind !== 'none').length

  // Nothing written, so nothing is coming
  if (toMark === 0) return null

  // How many of those are marked for good
  const marked = cells.filter((cell) => cell.kind === 'scored').length

  // The words for how far it has got: nothing in yet, some of it, or all of it
  const words =
    marked === 0
      ? t('resultsPending')
      : marked < toMark
        ? t('resultsView.partlyMarked', { marked, total: toMark })
        : t('resultsView.allMarked')

  // Said the same way whichever it is
  return <span className="tabular-nums text-muted/80">{words}</span>
}
