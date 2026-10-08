'use client'

import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { DefenseChatTrigger } from '@/components/features/defense/components/DefenseChatTrigger'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { type TabItem, Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'
import type { Locale } from '@/i18n/i18n'

import { useDetailTabCounts } from '../hooks/use-detail-tab-counts'
import { PROPOSAL_HEADING_ATTRIBUTE } from '../hooks/use-open-proposal'
import { DETAIL_TABS, type DetailTab, detailTabOf, proposalQuery } from '../model/selection-routes'
import { hasSolution, resolveText, unwrittenLanguages } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { LanguageSwitch } from './LanguageSwitch'
import { ProposalConversations } from './ProposalConversations'
import { ProposalFiling } from './ProposalFiling'
import { ProposalStatement } from './ProposalStatement'
import { ProposalSurfaces } from './ProposalSurfaces'
import { PoolLink } from './SelectionLinks'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

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

  // The selection
  const { selection } = useSelectionWorkspace()

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
    />
  )
}

/**
 * Props for the {@link ProposalDetailBody} component.
 */
type ProposalDetailBodyProps = Pick<ProposalDetailProps, 'poolLanguage'> & {
  /** The problem. */
  proposal: Proposal
}

/**
 * What one tab under the statement holds.
 */
type DetailTabContent = Omit<TabItem<DetailTab>, 'id'>

/**
 * The problem's page once it has loaded.
 */
function ProposalDetailBody({ proposal, poolLanguage }: ProposalDetailBodyProps) {
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

  // Keep the address naming the tab on screen, so a link copied from it opens the same one
  useAddressSync(proposalQuery({ proposalId: proposal.id, tab }))

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
            showLikes={false}
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

        {/* A conversation with Mathilda, where she has a solution in the site's language */}
        {siteText !== undefined && hasSolution(siteText) && (
          <div className="flex shrink-0 items-center">
            <DefenseChatTrigger
              problem={{
                target: { kind: 'proposal', problemId: proposal.id },
                statement: siteText.statement,
              }}
            />
          </div>
        )}
      </header>

      {/* What it is filed under, and the language it is read in */}
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
 * The way back to the pool.
 */
function BackToPool() {
  // Problem page copy
  const t = useTranslations('problemSelection.detail')

  return (
    <PoolLink className="inline-flex items-center gap-1.5 text-sm">
      <ArrowLeft size={15} />
      {t('backToPool')}
    </PoolLink>
  )
}
