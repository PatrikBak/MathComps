'use client'

import { useHotkeys } from '@mantine/hooks'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { DefenseChatTrigger } from '@/components/features/defense/components/DefenseChatTrigger'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { type TabItem, Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { countOpenDialogs, isInArrowKeyWidget } from '@/components/shared/utils/dom-utils'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'
import type { Locale } from '@/i18n/i18n'

import { useDetailTabCounts } from '../hooks/use-detail-tab-counts'
import { PROPOSAL_HEADING_ATTRIBUTE } from '../hooks/use-open-proposal'
import {
  DETAIL_TABS,
  type DetailTab,
  detailTabOf,
  PROPOSAL_PARAMS,
  proposalQuery,
} from '../model/selection-routes'
import { hasSolution, resolveText, unwrittenLanguages } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { LanguageSwitch } from './LanguageSwitch'
import { PlaceControl } from './PlaceControl'
import { ProposalActionsMenu } from './ProposalActionsMenu'
import { ProposalConversations } from './ProposalConversations'
import { ProposalFiling } from './ProposalFiling'
import { ProposalStatement } from './ProposalStatement'
import { ProposalSurfaces } from './ProposalSurfaces'
import { PoolLink } from './SelectionLinks'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/** The key going back to the pool from a problem. */
const BACK_TO_POOL_KEY = 'ArrowLeft'

/**
 * Props for the {@link ProposalDetail} component.
 */
type ProposalDetailProps = {
  /** The problem on screen. */
  proposalId: string
  /** The language the pool is read in. */
  poolLanguage: Locale
}

/**
 * One problem in full: what it is filed under, its statement in the language picked, and under it the hints, the
 * solution, every conversation reviewers held with Mathilda, and the discussion.
 */
export function ProposalDetail({ proposalId, poolLanguage }: ProposalDetailProps) {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // The selection, and the way back to the pool once the problem is gone
  const { selection, leaveProposal } = useSelectionWorkspace()

  // The selection still on its way
  if (selection === null) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface/25" aria-hidden />
  }

  // The problem, if the selection holds it
  const proposal = selection.proposalsById.get(proposalId)

  // The problem gone from the selection, or never in it
  if (proposal === undefined) {
    return (
      <div className="space-y-3">
        <BackToPool />
        <p className="text-sm text-muted">{t('notInPool')}</p>
      </div>
    )
  }

  return (
    <ProposalDetailBody
      // Keyed on the problem, so opening another one starts its page over
      key={proposal.id}
      proposal={proposal}
      poolLanguage={poolLanguage}
      onDeleted={leaveProposal}
    />
  )
}

/**
 * Props for the {@link ProposalDetailBody} component.
 */
type ProposalDetailBodyProps = Pick<ProposalDetailProps, 'poolLanguage'> & {
  /** The problem. */
  proposal: Proposal
  /** Runs once the reader confirms the problem's delete. */
  onDeleted: () => void
}

/**
 * What one tab under the statement holds.
 */
type DetailTabContent = Omit<TabItem<DetailTab>, 'id'>

/**
 * The problem's page once it has loaded.
 */
function ProposalDetailBody({ proposal, poolLanguage, onDeleted }: ProposalDetailBodyProps) {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // Discussion copy
  const tComments = useTranslations('problemSelection.comments')

  // The language the text is read in, starting at the pool's, or else the first this problem has
  const [language, setLanguage] = useState<Locale>(
    () => resolveText(proposal, poolLanguage)?.language ?? poolLanguage
  )

  // The tab the address opened the problem on, the first when it names none
  const addressedTab = useInitialUrlState(detailTabOf)

  // The tab showing, the addressed one at first
  const [tab, setTab] = useState<DetailTab>(addressedTab)

  // Keep the address naming the tab on screen, so a link copied from it opens the same one, every other
  // parameter left as it stands
  useAddressSync(proposalQuery({ proposalId: proposal.id, tab }), PROPOSAL_PARAMS)

  // How many conversations and comments the problem carries
  const counts = useDetailTabCounts(proposal.id)

  // What each tab holds
  const tabs: Record<DetailTab, DetailTabContent> = {
    conversations: {
      label: t('conversationsTab'),
      count: counts.conversations,
      panel: (
        <div className="pt-4">
          <ProposalConversations proposal={proposal} />
        </div>
      ),
    },
    comments: {
      label: t('commentsTab'),
      count: counts.comments,
      panel: (
        <div className="pt-4">
          <CommentSection
            variant="inline"
            newCommentPlaceholder={tComments('placeholder')}
            showEmptyText={false}
            target={{ targetType: 'Proposal', targetId: proposal.id }}
          />
        </div>
      ),
    },
  }

  // The site's language
  const siteLocale = useLocale() as Locale

  // The problem's text in the site's language, if it has one
  const siteText = proposal.texts[siteLocale]

  return (
    <article>
      {/* The way out */}
      <BackToPool />

      {/* Identity and the actions */}
      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* The problem's name */}
        <h2
          // Focused as the problem opens, so a reader's next Tab goes on from its name
          tabIndex={-1}
          {...PROPOSAL_HEADING_ATTRIBUTE.stamp(proposal.id)}
          className={cn(
            'text-lg font-semibold text-foreground hyphens-none focus:outline-none',
            'sm:min-w-0 sm:flex-1 sm:text-xl'
          )}
        >
          <span className="mr-1 font-normal tabular-nums text-muted">{`#${proposal.number}`}</span>{' '}
          {proposal.title}
        </h2>

        {/* The actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* A conversation with Mathilda, where she has a solution in the site's language */}
          {siteText !== undefined && hasSolution(siteText) && (
            <DefenseChatTrigger
              problem={{
                target: { kind: 'proposal', problemId: proposal.id },
                statement: siteText.statement,
              }}
            />
          )}

          {/* Placing the problem */}
          <PlaceControl proposal={proposal} />

          {/* The rarer things done to the problem */}
          <ProposalActionsMenu proposal={proposal} onDeleted={onDeleted} />
        </div>
      </header>

      {/* What it is filed under and where it sits, and the language it is read in */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ProposalFiling proposal={proposal} showCounts={false} />
        <LanguageSwitch
          language={language}
          onChange={setLanguage}
          unwritten={unwrittenLanguages(proposal)}
        />
      </div>

      {/* The statement */}
      <SurfacePanel as="section" radius="xl" className="mt-4 px-4 py-4 sm:px-5">
        <ProposalStatement proposal={proposal} language={language} />
      </SurfacePanel>

      {/* The hints and the solution, side by side */}
      <ProposalSurfaces proposal={proposal} language={language} className="mt-2" />

      {/* Conversations and discussion */}
      <div className="mt-6">
        <Tabs
          ariaLabel={t('tabsLabel')}
          selectedId={tab}
          onSelect={setTab}
          items={DETAIL_TABS.map((id): TabItem<DetailTab> => ({ id, ...tabs[id] }))}
        />
      </div>
    </article>
  )
}

/**
 * The way back to the pool, by the link or by {@link BACK_TO_POOL_KEY}. The key goes back only while it is the
 * page's: never once something on the page has acted on it, while a dialog stands over the page, or from inside a
 * widget the arrow keys already move within. Typing in a field keeps it too, since the hotkeys never fire there.
 */
function BackToPool() {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // A function which goes back to the pool
  const { closeProposal } = useSelectionWorkspace()

  // The key going back to the pool
  useHotkeys([
    [
      BACK_TO_POOL_KEY,
      (event) => {
        // A key something on the page already acted on, a dialog over the page, or a widget the arrows move
        // within keeps the key
        if (event.defaultPrevented || countOpenDialogs() > 0 || isInArrowKeyWidget(event.target)) {
          return
        }

        // The key claimed for the page
        event.preventDefault()

        // Back to the pool
        closeProposal()
      },
      // Claimed only once it is the page's, so a widget that keeps the key still gets it untouched
      { preventDefault: false },
    ],
  ])

  return (
    <PoolLink
      aria-keyshortcuts={BACK_TO_POOL_KEY}
      className="inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft size={15} />
      {t('backToPool')}
    </PoolLink>
  )
}
