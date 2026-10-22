'use client'

import { useTranslations } from 'next-intl'
import { useRef } from 'react'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { hueTextStyle } from '@/components/shared/utils/hue-colors'
import type { TableSort } from '@/components/shared/utils/table-sort'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

import { useDetailTab } from '../hooks/use-detail-tab'
import { usePaperCommentCount } from '../hooks/use-paper-comment-count'
import { useSubjectDiscussion } from '../hooks/use-subject-discussion'
import { DEFAULT_RATINGS_SORT, type RatingsColumn } from '../model/ratings-order'
import { PAPER_TABS, type PaperTab } from '../model/selection-routes'
import { categoryHue, type SlotPosition, unwrittenAcross } from '../model/selection-state'
import type { Board, Paper, Proposal } from '../model/selection-types'
import { SlotNumber } from './CategoryMarks'
import { DetailHeading, DetailMissing, type DetailTabContent } from './DetailFrame'
import { LanguageSwitch } from './LanguageSwitch'
import { MarkSeenButton } from './MarkSeenButton'
import { ProposalBox } from './ProposalBody'
import { ProposalCard } from './ProposalCard'
import { AreaChip, RatingsMark } from './ProposalFiling'
import { RatingsTable } from './RatingsTable'
import { BackLink } from './SelectionLinks'
import { useLoadedSelection } from './SelectionWorkspaceProvider'

/**
 * Whether each tab of a paper's page shows its problems' statements, and so, where they need every language, carries
 * the language they are read in.
 */
const SHOWS_STATEMENTS: Record<PaperTab, boolean> = {
  problems: true,
  comments: false,
  ratings: false,
}

/** Whether each tab of a paper's page shows its discussion, and so carries the eye while something there is new. */
const SHOWS_DISCUSSION: Record<PaperTab, boolean> = {
  problems: false,
  comments: true,
  ratings: false,
}

/**
 * What a reader last chose on a paper's page, kept for the paper while its page is closed.
 */
export type PaperChoices = {
  /** The language the paper's problems are read in; undefined while none has been picked. */
  language?: Locale
  /** How the paper's ratings table orders its rows; undefined while no column has been chosen. */
  ratingsSort?: TableSort<RatingsColumn>
}

/**
 * Props for the {@link PaperDetail} component.
 */
type PaperDetailProps = {
  /** The paper on screen. */
  paperId: string
  /** The language the pool is read in. */
  poolLanguage: Locale
  /** What was last chosen on the paper's page. */
  choices: PaperChoices
  /** Keeps a choice made on the paper's page. */
  onChoice: (choice: PaperChoices) => void
}

/**
 * One paper in full: its problems in their slots' order, each with its statement, hints and solution, the reviewers'
 * discussion of the paper as a whole, and a table of its problems' ratings.
 */
export function PaperDetail({ paperId, poolLanguage, choices, onChoice }: PaperDetailProps) {
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
      choices={choices}
      onChoice={onChoice}
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
function PaperDetailBody({ board, paper, poolLanguage, choices, onChoice }: PaperDetailBodyProps) {
  // Paper page copy
  const t = useTranslations('problemSelection.paper')

  // Every problem by id, the selection's categories, and whether the problems need every language
  const { proposalsById, categories, needsEveryLanguage } = useLoadedSelection()

  // The problem in each slot, undefined where the slot stands empty
  const slotProposals = paper.slots.map((proposalId) =>
    proposalId === null ? undefined : proposalsById.get(proposalId)
  )

  // The problems in the paper's filled slots
  const proposals = slotProposals.filter((proposal): proposal is Proposal => proposal !== undefined)

  // The languages none of the paper's problems is written in
  const unwritten = unwrittenAcross(proposals)

  // The language the problems are read in: the one last picked for the paper, else the pool's, or the first one some
  // problem here is written in when none is written in the pool's
  const language =
    choices.language ??
    (unwritten.includes(poolLanguage)
      ? (SUPPORTED_LOCALES.find((candidate) => !unwritten.includes(candidate)) ?? poolLanguage)
      : poolLanguage)

  // How many comments the paper's discussion holds
  const commentCount = usePaperCommentCount(paper.id)

  // The ratings panel
  const ratingsPanelRef = useRef<HTMLDivElement>(null)

  // The tab showing, and the way to show another
  const { tab, showTab } = useDetailTab({
    tabs: PAPER_TABS,
    pageOn: (shown) => ({ kind: 'paper', id: paper.id, tab: shown }),
  })

  // The paper's discussion, with what in it is new
  const discussion = useSubjectDiscussion({ targetType: 'SelectionPaper', targetId: paper.id })

  // The discussion's panel
  const commentsPanelRef = useRef<HTMLDivElement>(null)

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
      // Read in the accent colour while somebody else's comment waits unseen behind another tab
      isHighlighted: discussion.hasNews,
      panel: (
        <div
          ref={commentsPanelRef}
          // Takes the focus when the eye marking the discussion seen leaves holding it
          tabIndex={-1}
          className="pt-4 focus:outline-none"
        >
          <CommentSection
            variant="inline"
            newCommentPlaceholder={t('placeholder')}
            showEmptyText={false}
            target={{ targetType: 'SelectionPaper', targetId: paper.id }}
            newness={discussion.newness}
          />
        </div>
      ),
    },
    ratings: {
      label: t('ratingsTab'),
      count: null,
      panel: (
        <div
          ref={ratingsPanelRef}
          // Takes the focus when a focused row leaves with no row in its place
          tabIndex={-1}
          className="pt-4 focus:outline-none"
        >
          {/* The problems' ratings, or a line saying the paper holds none */}
          {proposals.length === 0 ? (
            // A note saying the paper holds no problem
            <div className={COMPACT_PANEL_CLASS}>
              <p className="text-sm text-muted">{t('noProblems')}</p>
            </div>
          ) : (
            // A row for every problem in the paper
            <RatingsTable
              proposals={proposals}
              sort={choices.ratingsSort ?? DEFAULT_RATINGS_SORT}
              onSort={(ratingsSort) => onChoice({ ratingsSort })}
              fallbackRef={ratingsPanelRef}
            />
          )}
        </div>
      ),
    },
  }

  return (
    <article>
      {/* The way out */}
      <BackLink />

      {/* The paper's name and its board, and over its problems' statements the language they are read in, where they
          need every language */}
      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <DetailHeading subjectId={paper.id}>
          <span style={hueTextStyle(categoryHue(categories, paper.category))}>{paper.name}</span>{' '}
          <span className="ml-1 font-normal text-muted">{board.name}</span>
        </DetailHeading>
        {needsEveryLanguage && (
          <div
            // Hidden but holding its room on a tab without statements, so the tabs stay put as they switch
            className={cn(!SHOWS_STATEMENTS[tab] && 'invisible')}
          >
            <LanguageSwitch
              language={language}
              onChange={(picked) => onChoice({ language: picked })}
              unwritten={unwritten}
            />
          </div>
        )}
      </header>

      {/* The paper's tabs */}
      <div className="mt-4">
        <Tabs
          ariaLabel={t('tabsLabel')}
          selectedId={tab}
          onSelect={showTab}
          items={PAPER_TABS.map((id) => ({ id, ...contents[id] }))}
          trailing={
            // The eye, while the discussion's tab is open and shows something new
            SHOWS_DISCUSSION[tab] && discussion.showsNew ? (
              <MarkSeenButton onPress={discussion.markSeen} fallbackRef={commentsPanelRef} />
            ) : undefined
          }
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
 * One slot of a paper's page: the problem's card marked with the slot's label and showing the problem's area and how
 * many reviewers rated it, or a box saying the slot is empty.
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

  // The problem's card, marked with the slot's label and showing the problem's area and ratings
  return (
    <li>
      <ProposalCard
        proposal={proposal}
        language={language}
        leadsToPage
        mark={<SlotNumber paper={paper} index={index} state="filled" />}
        actions={null}
        details={
          // The problem's area and how many reviewers rated it
          <>
            <AreaChip area={proposal.area} />
            <RatingsMark ratings={proposal.ratings} />
          </>
        }
      />
    </li>
  )
}
