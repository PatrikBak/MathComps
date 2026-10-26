'use client'

import { MessageSquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { PageHeader } from '@/components/shared/components/PageHeader'
import { useAddressedDisclosure } from '@/hooks/use-addressed-disclosure'

import { useHostedCompetitionsBoard } from '../hooks/use-hosted-competitions-board'
import type { EntryBlocker } from '../model/entry-reader'
import { RESULTS_PARAM } from '../services/hosted-competition-routes'
import { CategoryLegend } from './CategoryLegend'
import { CompetitionResultsModal } from './CompetitionResults'
import { DisclosureNote } from './DisclosureNote'
import { EntryGate } from './EntryGate'
import { HeaderDisclosure } from './HeaderDisclosure'
import { HostedCompetitionEntryDialog } from './HostedCompetitionEntryDialog'
import { HostedCompetitionSeason } from './HostedCompetitionSeason'
import { HowItWorks } from './HowItWorks'
import { PracticeBar } from './PracticeBar'
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
 *
 * The practice competition leads, being open at any time to anybody with an account. Under it the graded
 * rounds sit in tabs, one school year at a time.
 */
export function HostedCompetitionsBoard({ entryIntentSlug }: HostedCompetitionsBoardProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The page's own name and description
  const tPage = useTranslations('pages.competitions')

  // What there is to draw, and what its presses go through
  const {
    layout,
    preparesCompetitions,
    listState,
    now,
    gateBlocker,
    needsRulesAccept,
    dialog,
    enterCompetition,
    dismissProfilePrompt,
  } = useHostedCompetitionsBoard(entryIntentSlug)

  // Which competition's results are open, one answer for every row on the page
  const openedResults = useAddressedDisclosure(RESULTS_PARAM)

  // The way to hide each step the reader still owes, where one can be hidden
  const dismissFor: Record<EntryBlocker, (() => void) | undefined> = {
    signIn: undefined,
    profile: dismissProfilePrompt,
  }

  return (
    // Hyphenation off: the global setting is for article prose, and here it would break names and labels mid-word
    <div className="mx-auto max-w-4xl hyphens-none">
      {/* What this page is, before any competition on it can be pressed */}
      <PageHeader title={tPage('title')} className="mb-0">
        {/* Page description */}
        <p>{tPage('description')}</p>

        {/* The header's rows */}
        <div className="space-y-2">
          {/* How a competition runs */}
          <HowItWorks />

          {/* Which category to pick */}
          <CategoryLegend />

          {/* The rules, readable without going near an irreversible press */}
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
          <EntryGate blocker={gateBlocker} onDismiss={dismissFor[gateBlocker]} />
        )}
      </PageHeader>

      {/* The list once there is one to draw, and where its read stands until then */}
      <div className="mt-8 sm:mt-10">
        {listState.kind !== 'ready' || layout === null ? (
          <FetchStatePlaceholder
            uiState={listState}
            className="flex flex-col items-center gap-3 py-16 text-center"
            empty={<p className="text-sm text-muted">{t('noCompetitions')}</p>}
            failed={<p className="text-sm text-muted">{t('loadFailed')}</p>}
          />
        ) : (
          <div className="space-y-8">
            {/* The practice competition */}
            {layout.practice.map((group) => (
              <PracticeBar
                key={group.id}
                group={group}
                now={now}
                preparesCompetitions={preparesCompetitions}
                onEnter={enterCompetition}
              />
            ))}

            {/* And the graded rounds, a tab each */}
            <HostedCompetitionSeason
              years={layout.years}
              now={now}
              preparesCompetitions={preparesCompetitions}
              onEnter={enterCompetition}
              onOpenResults={openedResults.open}
            />
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

      {/* How everybody did in one competition, once a row asks */}
      <CompetitionResultsModal disclosure={openedResults} />
    </div>
  )
}
