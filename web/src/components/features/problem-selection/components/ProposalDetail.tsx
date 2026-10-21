'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { Tabs } from '@/components/shared/components/Tabs'
import type { Locale } from '@/i18n/i18n'

import { useDetailTab } from '../hooks/use-detail-tab'
import { useProposalTabCounts } from '../hooks/use-proposal-tab-counts'
import { PROPOSAL_TABS, type ProposalTab } from '../model/selection-routes'
import { resolveText, unwrittenAcross } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { DetailMissing, type DetailTabContent } from './DetailFrame'
import { LanguageSwitch } from './LanguageSwitch'
import { PlaceControl } from './PlaceControl'
import { ProposalActionsMenu } from './ProposalActionsMenu'
import { ProposalCard } from './ProposalCard'
import { ProposalConversations } from './ProposalConversations'
import { ProposalFiling } from './ProposalFiling'
import { BackLink } from './SelectionLinks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

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
 * One problem in full: what it is filed under, its statement in the language being read, and under it the hints, the
 * solution, every conversation reviewers held with Mathilda, and the discussion.
 */
export function ProposalDetail({ proposalId, poolLanguage }: ProposalDetailProps) {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  // Every problem, by id
  const { proposalsById } = useLoadedSelection()

  // The way back once the problem is gone
  const { leaveDetail } = useSelectionWorkspace()

  // The problem, if the selection holds it
  const proposal = proposalsById.get(proposalId)

  // The problem gone from the selection, or never in it
  if (proposal === undefined) return <DetailMissing message={t('notInPool')} />

  return (
    <ProposalDetailBody
      // Keyed on the problem, so opening another one starts its page over
      key={proposal.id}
      proposal={proposal}
      poolLanguage={poolLanguage}
      onDeleted={leaveDetail}
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

  // How many conversations and comments the problem carries
  const counts = useProposalTabCounts(proposal.id)

  // The tab showing, and the way to show another
  const { tab, showTab } = useDetailTab({
    tabs: PROPOSAL_TABS,
    pageOn: (shown) => ({ kind: 'proposal', id: proposal.id, tab: shown }),
  })

  // What each tab holds
  const contents: Record<ProposalTab, DetailTabContent<ProposalTab>> = {
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

  // Whether the problems need every language
  const { needsEveryLanguage } = useLoadedSelection()

  return (
    <article>
      {/* The way out and, where the problems need every language, the language the problem is read in */}
      <div className="flex items-center justify-between gap-3">
        {/* The way out */}
        <BackLink />

        {/* The language */}
        {needsEveryLanguage && (
          <LanguageSwitch
            language={language}
            onChange={setLanguage}
            unwritten={unwrittenAcross([proposal])}
          />
        )}
      </div>

      {/* The problem under its name, with what it is filed under and what can be done to it */}
      <ProposalCard
        proposal={proposal}
        language={language}
        leadsToPage={false}
        mark={null}
        actions={
          <>
            <PlaceControl proposal={proposal} />
            <ProposalActionsMenu proposal={proposal} onDeleted={onDeleted} />
          </>
        }
        details={<ProposalFiling proposal={proposal} />}
        className="mt-4"
      />

      {/* Conversations and discussion */}
      <div className="mt-6">
        <Tabs
          ariaLabel={t('tabsLabel')}
          selectedId={tab}
          onSelect={showTab}
          items={PROPOSAL_TABS.map((id) => ({ id, ...contents[id] }))}
        />
      </div>
    </article>
  )
}
