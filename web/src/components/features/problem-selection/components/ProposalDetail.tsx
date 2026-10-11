'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import type { Locale } from '@/i18n/i18n'

import { useProposalTabCounts } from '../hooks/use-proposal-tab-counts'
import { PROPOSAL_TABS, type ProposalTab } from '../model/selection-routes'
import { resolveText, unwrittenAcross } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { DetailHeading, DetailMissing, type DetailTabContent, DetailTabs } from './DetailFrame'
import { LanguageSwitch } from './LanguageSwitch'
import { PlaceControl } from './PlaceControl'
import { ProposalActionsMenu } from './ProposalActionsMenu'
import { ProposalBody, ProposalBox } from './ProposalBody'
import { ProposalChatTrigger } from './ProposalChatTrigger'
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
 * One problem in full: what it is filed under, its statement in the language picked, and under it the hints, the
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

  return (
    <article>
      {/* The way out */}
      <BackLink />

      {/* Identity and the actions */}
      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* The problem's name */}
        <DetailHeading subjectId={proposal.id} className="text-foreground sm:min-w-0 sm:flex-1">
          <span className="mr-1 font-normal tabular-nums text-muted">{`#${proposal.number}`}</span>{' '}
          {proposal.title}
        </DetailHeading>

        {/* The actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* A conversation with Mathilda */}
          <ProposalChatTrigger proposal={proposal} />

          {/* Placing the problem */}
          <PlaceControl proposal={proposal} />

          {/* The rarer things done to the problem */}
          <ProposalActionsMenu proposal={proposal} onDeleted={onDeleted} />
        </div>
      </header>

      {/* What it is filed under and where it sits, and the language it is read in */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ProposalFiling proposal={proposal} />
        <LanguageSwitch
          language={language}
          onChange={setLanguage}
          unwritten={unwrittenAcross([proposal])}
        />
      </div>

      {/* The statement, with the hints and the solution under it */}
      <ProposalBox as="section" className="mt-4">
        <ProposalBody proposal={proposal} language={language} />
      </ProposalBox>

      {/* Conversations and discussion */}
      <div className="mt-6">
        <DetailTabs
          ariaLabel={t('tabsLabel')}
          tabs={PROPOSAL_TABS}
          contents={contents}
          pageOn={(tab) => ({ kind: 'proposal', id: proposal.id, tab })}
        />
      </div>
    </article>
  )
}
