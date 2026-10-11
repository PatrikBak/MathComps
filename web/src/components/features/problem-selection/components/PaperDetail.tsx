'use client'

import { useTranslations } from 'next-intl'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { categoryTextClass } from '@/components/features/hosted-competitions/components/CategoryBadge'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

import { usePaperCommentCount } from '../hooks/use-paper-comment-count'
import { PAPER_TABS, type PaperTab } from '../model/selection-routes'
import { type SlotPosition, unwrittenAcross } from '../model/selection-state'
import type { Board, Paper, Proposal } from '../model/selection-types'
import { SlotNumber } from './CategoryMarks'
import { DetailHeading, DetailMissing, type DetailTabContent, DetailTabs } from './DetailFrame'
import { LanguageSwitch } from './LanguageSwitch'
import { ProposalBox } from './ProposalBody'
import { ProposalCard } from './ProposalCard'
import { BackLink } from './SelectionLinks'
import { useLoadedSelection } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link PaperDetail} component.
 */
type PaperDetailProps = {
  /** The paper on screen. */
  paperId: string
  /** The language the pool is read in. */
  poolLanguage: Locale
  /** The language last picked for the paper; undefined while none has been. */
  keptLanguage: Locale | undefined
  /** Keeps the language picked for the paper. */
  onLanguageChange: (language: Locale) => void
}

/**
 * One paper in full: its problems in their slots' order, each with its statement, hints and solution, and the
 * reviewers' discussion of the paper as a whole.
 */
export function PaperDetail({
  paperId,
  poolLanguage,
  keptLanguage,
  onLanguageChange,
}: PaperDetailProps) {
  // Paper page copy
  const t = useTranslations('problemSelection.paper')

  // Every paper and the board holding it, by the paper's id
  const { papersById } = useLoadedSelection()

  // The paper and the board holding it, if any board does
  const place = papersById.get(paperId)

  // The paper on no board the selection holds
  if (place === undefined) return <DetailMissing message={t('notFound')} />

  return (
    <PaperDetailBody
      // Keyed on the paper, so opening another one starts its page over
      key={paperId}
      board={place.board}
      paper={place.paper}
      poolLanguage={poolLanguage}
      keptLanguage={keptLanguage}
      onLanguageChange={onLanguageChange}
    />
  )
}

/**
 * Props for the {@link PaperDetailBody} component.
 */
type PaperDetailBodyProps = Omit<PaperDetailProps, 'paperId'> & {
  /** The board holding the paper. */
  board: Board
  /** The paper. */
  paper: Paper
}

/**
 * The paper's page once it has loaded.
 */
function PaperDetailBody({
  board,
  paper,
  poolLanguage,
  keptLanguage,
  onLanguageChange,
}: PaperDetailBodyProps) {
  // Paper page copy
  const t = useTranslations('problemSelection.paper')

  // Every problem, by id
  const { proposalsById } = useLoadedSelection()

  // The problem in each slot, undefined where the slot stands empty
  const slotProposals = paper.slots.map((proposalId) =>
    proposalId === null ? undefined : proposalsById.get(proposalId)
  )

  // The languages none of the paper's problems is written in
  const unwritten = unwrittenAcross(
    slotProposals.filter((proposal): proposal is Proposal => proposal !== undefined)
  )

  // The language the problems are read in: the one last picked for the paper, else the pool's, or the first one some
  // problem here is written in when none is written in the pool's
  const language =
    keptLanguage ??
    (unwritten.includes(poolLanguage)
      ? (SUPPORTED_LOCALES.find((candidate) => !unwritten.includes(candidate)) ?? poolLanguage)
      : poolLanguage)

  // How many comments the paper's discussion holds
  const commentCount = usePaperCommentCount(paper.id)

  // What each tab holds
  const contents: Record<PaperTab, DetailTabContent<PaperTab>> = {
    problems: {
      label: t('problemsTab'),
      count: null,
      panel: (
        <ol className="space-y-4 pt-4">
          {slotProposals.map((proposal, index) => (
            <PaperProblem
              // Keyed on the problem, so a slot taken over by another one starts over
              key={proposal?.id ?? index}
              paper={paper}
              index={index}
              proposal={proposal}
              language={language}
            />
          ))}
        </ol>
      ),
    },
    comments: {
      label: t('commentsTab'),
      count: commentCount,
      panel: (
        <div className="pt-4">
          <CommentSection
            variant="inline"
            newCommentPlaceholder={t('placeholder')}
            showEmptyText={false}
            target={{ targetType: 'SelectionPaper', targetId: paper.id }}
          />
        </div>
      ),
    },
  }

  return (
    <article>
      {/* The way out */}
      <BackLink />

      {/* The paper's name and its board, and the language its problems are read in */}
      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <DetailHeading subjectId={paper.id} className={categoryTextClass(paper.category)}>
          {paper.name} <span className="ml-1 font-normal text-muted">{board.name}</span>
        </DetailHeading>
        <LanguageSwitch language={language} onChange={onLanguageChange} unwritten={unwritten} />
      </header>

      {/* The problems and the discussion */}
      <div className="mt-4">
        <DetailTabs
          ariaLabel={t('tabsLabel')}
          tabs={PAPER_TABS}
          contents={contents}
          pageOn={(tab) => ({ kind: 'paper', id: paper.id, tab })}
        />
      </div>
    </article>
  )
}

/**
 * Props for the {@link PaperProblem} component.
 */
type PaperProblemProps = SlotPosition & {
  /** The problem in the slot; undefined while the slot stands empty. */
  proposal: Proposal | undefined
  /** The language the problem is read in. */
  language: Locale
}

/**
 * One slot of a paper's page: the problem's card marked with the slot's label, or a box saying the slot is
 * empty.
 */
function PaperProblem({ paper, index, proposal, language }: PaperProblemProps) {
  // Board copy
  const tBoard = useTranslations('problemSelection.board')

  // An empty slot, whose box only says so
  if (proposal === undefined) {
    return (
      <li>
        <ProposalBox className="flex items-center gap-3 py-3 text-sm text-muted">
          <SlotNumber paper={paper} index={index} state="empty" />
          {tBoard('empty')}
        </ProposalBox>
      </li>
    )
  }

  // The problem's card, marked with the slot's label
  return (
    <li>
      <ProposalCard
        proposal={proposal}
        language={language}
        mark={<SlotNumber paper={paper} index={index} state="filled" />}
        actions={null}
        details={null}
      />
    </li>
  )
}
