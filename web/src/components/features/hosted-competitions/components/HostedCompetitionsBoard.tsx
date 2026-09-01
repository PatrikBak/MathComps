'use client'

import { MessageSquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { PageHeader } from '@/components/shared/components/PageHeader'

import { useHostedCompetitionsBoard } from '../hooks/use-hosted-competitions-board'
import { CategoryLegend } from './CategoryLegend'
import { DisclosureNote } from './DisclosureNote'
import { EntryGate } from './EntryGate'
import { HeaderDisclosure } from './HeaderDisclosure'
import { HostedCompetitionEntryDialog } from './HostedCompetitionEntryDialog'
import { HostedCompetitionGroupPanel } from './HostedCompetitionGroupPanel'
import { HowItWorks } from './HowItWorks'
import { RulesList } from './RulesList'

/**
 * Props for the {@link HostedCompetitionsBoard} component.
 */
type HostedCompetitionsBoardProps = {
  /** Which competition a press made before signing in was aimed at. */
  entryIntentSlug: string | undefined
}

/**
 * Every competition the program has run or will run, and the way into whichever one is open.
 */
export function HostedCompetitionsBoard({ entryIntentSlug }: HostedCompetitionsBoardProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The page's own name and description
  const tPage = useTranslations('pages.competitions')

  // What there is to draw, and what its presses go through
  const {
    groups,
    listState,
    now,
    gateBlocker,
    needsRulesAccept,
    dialog,
    enterCompetition,
    dismissProfilePrompt,
  } = useHostedCompetitionsBoard(entryIntentSlug)

  return (
    // Hyphenation off: the global setting is for article prose, and the words here are names and labels
    <div className="mx-auto max-w-4xl hyphens-none">
      {/* What this page is, before anything can be pressed on it */}
      <PageHeader title={tPage('title')} className="mb-0">
        <p>{tPage('description')}</p>

        {/* What the thing is, which category to pick, and what an entry agrees to */}
        <div className="space-y-2">
          <HowItWorks />
          <CategoryLegend />

          {/* The rules, readable without going near an irreversible press. The same lines appear inside
              the entry dialog on the one entry that accepts them; after that, this is where they live */}
          <HeaderDisclosure label={t('rulesButton')}>
            {/* The terms themselves */}
            <RulesList />

            {/* Where to take anything the rules do not answer */}
            <DisclosureNote icon={MessageSquarePlus}>
              {t.rich('rules.contact', {
                link: (chunks) => <ProseContactLink reason="other">{chunks}</ProseContactLink>,
              })}
            </DisclosureNote>
          </HeaderDisclosure>
        </div>

        {/* What the reader still owes, said before they reach for a button */}
        {gateBlocker !== null && (
          <EntryGate
            blocker={gateBlocker}
            onDismiss={gateBlocker === 'profile' ? dismissProfilePrompt : undefined}
          />
        )}
      </PageHeader>

      {/* The list, once there is one to draw */}
      <div className="mt-8 sm:mt-10">
        {listState.kind !== 'ready' || groups.length === 0 ? (
          <FetchStatePlaceholder
            uiState={listState}
            className="flex flex-col items-center gap-3 py-16 text-center"
            empty={<p className="text-sm text-muted">{t('noCompetitions')}</p>}
            failed={<p className="text-sm text-muted">{t('loadFailed')}</p>}
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <HostedCompetitionGroupPanel
                key={group.id}
                group={group}
                now={now}
                onEnter={enterCompetition}
              />
            ))}
          </div>
        )}
      </div>

      {/* The question that has to be answered before any clock starts */}
      {dialog.pending !== null && (
        <HostedCompetitionEntryDialog
          group={dialog.pending.group}
          competition={dialog.pending.competition}
          needsRulesAccept={needsRulesAccept}
          onClose={dialog.close}
          onConfirm={dialog.confirm}
          onForfeit={dialog.forfeit}
          isEntering={dialog.isEntering}
        />
      )}
    </div>
  )
}
