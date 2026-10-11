'use client'

import { useHotkeys } from '@mantine/hooks'
import { ArrowLeft, type LucideIcon, MessageSquare, MessagesSquare } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'

import {
  PROBLEM_ROW_CLASS,
  ProblemRowLabel,
} from '@/components/features/hosted-competitions/components/CompetitionProblemSurface'
import { AppLink } from '@/components/shared/components/AppLink'
import { countOpenDialogs, isInArrowKeyWidget } from '@/components/shared/utils/dom-utils'
import { isPlainClick } from '@/components/shared/utils/event-utils'
import { ROUTES } from '@/i18n/i18n'

import { useProposalTabCounts } from '../hooks/use-proposal-tab-counts'
import {
  detailHref,
  type DetailPage,
  OPEN_PAPER_PARAM,
  PROPOSAL_TABS,
  type ProposalTab,
} from '../model/selection-routes'
import type { Paper } from '../model/selection-types'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/** The key going back from a page open over the pool. */
const BACK_KEY = 'ArrowLeft'

/** The icon marking what each tab of a problem's page holds. */
const TAB_ICONS: Record<ProposalTab, LucideIcon> = {
  conversations: MessagesSquare,
  comments: MessageSquare,
}

/**
 * Props every selection link takes: anything an {@link AppLink} takes except where it goes, what a click does
 * and whether it prefetches, which each link sets itself.
 */
type SelectionLinkBaseProps = Omit<ComponentProps<typeof AppLink>, 'href' | 'onClick' | 'prefetch'>

/**
 * Props for the {@link SelectionLink} component.
 */
type SelectionLinkProps = SelectionLinkBaseProps & {
  /** Where the link goes when the browser follows it. */
  href: ComponentProps<typeof AppLink>['href']
  /** What a plain click does, in place of following the link. */
  onPlainClick: () => void
}

/**
 * A link a plain click acts on without leaving the page. A click held with a modifier is left to the browser,
 * which opens it in a new tab or window.
 */
function SelectionLink({ href, onPlainClick, ...rest }: SelectionLinkProps) {
  return (
    <AppLink
      href={href}
      // A plain click stays on this page, so there is nothing to fetch ahead
      prefetch={false}
      onClick={(event) => {
        // A click held with a modifier is left to the browser
        if (!isPlainClick(event)) return

        // The link itself is not followed
        event.preventDefault()

        // The page acts on the click instead
        onPlainClick()
      }}
      {...rest}
    />
  )
}

/**
 * Props for the {@link DetailLink} component.
 */
type DetailLinkProps = SelectionLinkBaseProps & {
  /** The page the link opens, and the tab it opens on. */
  page: DetailPage
}

/**
 * A link that opens a page in full over the pool without leaving the page. Clicked or followed, it keeps the paper
 * the address names, as {@link detailHref} does.
 */
function DetailLink({ page, ...rest }: DetailLinkProps) {
  // A function which opens a page in full over the pool
  const { openDetail } = useSelectionWorkspace()

  // The paper the address names, if any
  const paperId = useSearchParams().get(OPEN_PAPER_PARAM)

  return (
    <SelectionLink
      href={detailHref(page, paperId)}
      onPlainClick={() => openDetail(page)}
      {...rest}
    />
  )
}

/**
 * Props for the {@link ProposalLink} component.
 */
type ProposalLinkProps = SelectionLinkBaseProps & {
  /** The problem the link opens. */
  proposalId: string
}

/**
 * A link that opens a problem in full without leaving the page.
 */
export function ProposalLink({ proposalId, ...rest }: ProposalLinkProps) {
  // The problem's page, on its first tab
  return <DetailLink page={{ kind: 'proposal', id: proposalId, tab: undefined }} {...rest} />
}

/**
 * Props for the {@link PaperLink} component.
 */
type PaperLinkProps = SelectionLinkBaseProps & {
  /** The paper the link opens. */
  paperId: string
}

/**
 * A link that opens a paper in full without leaving the page.
 */
export function PaperLink({ paperId, ...rest }: PaperLinkProps) {
  // The paper's page, on its first tab
  return <DetailLink page={{ kind: 'paper', id: paperId, tab: undefined }} {...rest} />
}

/**
 * Where the way back from a page open over the pool leads.
 */
type WayBack = {
  /** Where the link goes when the browser follows it. */
  href: ComponentProps<typeof AppLink>['href']
  /** Goes back without leaving the page. */
  go: () => void
  /** What the link says. */
  name: string
}

/**
 * The way back from a page open over the pool, by the link or by {@link BACK_KEY}: to the paper a problem was opened
 * over, where the selection still holds it, and to the pool otherwise. The key goes back only while it is the
 * page's: never once something on the page has acted on it, while a dialog stands over the page, or from inside a
 * widget the arrow keys already move within. Typing in a field keeps it too, since the hotkeys never fire there.
 */
export function BackLink() {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // Every paper and the board holding it, by the paper's id
  const { papersById } = useLoadedSelection()

  // The paper the open problem was opened over, and the ways to a paper and to the pool
  const { paperBeneathId, openDetail, closeDetail } = useSelectionWorkspace()

  // The paper the open problem was opened over, where the selection still holds it
  const paperBeneath = paperBeneathId === null ? undefined : papersById.get(paperBeneathId)?.paper

  // Back to the paper's page, or to the pool where no paper is there to go back to
  const back: WayBack =
    paperBeneath === undefined
      ? { href: ROUTES.PROBLEM_SELECTION, go: closeDetail, name: t('backToPool') }
      : {
          href: detailHref({ kind: 'paper', id: paperBeneath.id, tab: undefined }, null),
          go: () => openDetail({ kind: 'paper', id: paperBeneath.id, tab: undefined }),
          name: paperBeneath.name,
        }

  // The key going back
  useHotkeys([
    [
      BACK_KEY,
      (event) => {
        // A key something on the page already acted on, a dialog over the page, or a widget the arrows move
        // within keeps the key
        if (event.defaultPrevented || countOpenDialogs() > 0 || isInArrowKeyWidget(event.target)) {
          return
        }

        // The key claimed for the page
        event.preventDefault()

        // Back where the link leads
        back.go()
      },
      // Claimed only once it is the page's, so a widget that keeps the key still gets it untouched
      { preventDefault: false },
    ],
  ])

  return (
    <SelectionLink
      href={back.href}
      onPlainClick={back.go}
      aria-keyshortcuts={BACK_KEY}
      className="inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft size={15} />
      {back.name}
    </SelectionLink>
  )
}

/**
 * Props for the {@link PaperCommentsLink} component.
 */
type PaperCommentsLinkProps = {
  /** The paper. */
  paper: Paper
  /** How many comments the paper's discussion holds. */
  count: number
}

/**
 * How many comments a paper's discussion holds, opening the paper on them. Absent while there are none.
 */
export function PaperCommentsLink({ paper, count }: PaperCommentsLinkProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // Nothing to count, nothing to show
  if (count === 0) return null

  // The count in words, naming the paper so the link says whose comments it opens
  const label = t('paperComments', { paper: paper.name, count })

  // The icon marking comments
  const Icon = TAB_ICONS.comments

  return (
    <DetailLink
      page={{ kind: 'paper', id: paper.id, tab: 'comments' }}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-1 text-xs tabular-nums"
    >
      <Icon size={13} />
      {count}
    </DetailLink>
  )
}

/**
 * Props for the {@link ProposalTabRows} component.
 */
type ProposalTabRowsProps = {
  /** The problem. */
  proposalId: string
}

/**
 * A row for each tab of a problem's page, opening the problem on it, with the tab's count once it holds
 * anything.
 */
export function ProposalTabRows({ proposalId }: ProposalTabRowsProps) {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // How many conversations and comments the problem carries
  const counts = useProposalTabCounts(proposalId)

  // The name of each tab
  const labels: Record<ProposalTab, string> = {
    conversations: t('conversationsTab'),
    comments: t('commentsTab'),
  }

  // A row per tab, in the tabs' order
  return PROPOSAL_TABS.map((tab) => (
    <DetailLink
      key={tab}
      page={{ kind: 'proposal', id: proposalId, tab }}
      className={PROBLEM_ROW_CLASS}
      plain
    >
      <ProblemRowLabel label={labels[tab]} icon={TAB_ICONS[tab]} count={counts[tab]} />
    </DetailLink>
  ))
}
