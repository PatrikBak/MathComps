'use client'

import { useTranslations } from 'next-intl'

import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { PageHeader } from '@/components/shared/components/PageHeader'
import { useNow } from '@/hooks/use-now'
import type { QueryUiState } from '@/lib/query-ui-state'

import { useEntryGuard } from '../hooks/use-entry-guard'
import { useEntryReader } from '../hooks/use-entry-reader'
import { useHostedCompetitionEntryDialog } from '../hooks/use-hosted-competition-entry-dialog'
import { useHostedCompetitionsView } from '../hooks/use-hosted-competitions-view'
import { entryBlocker, hasAccount } from '../model/entry-reader'
import { orderForReading } from '../model/hosted-competition-state'
import { CategoryLegend } from './CategoryLegend'
import { EntryGate } from './EntryGate'
import { HostedCompetitionEntryDialog } from './HostedCompetitionEntryDialog'
import { HostedCompetitionGroupPanel } from './HostedCompetitionGroupPanel'
import { HowItWorks } from './HowItWorks'
import { RulesNote } from './RulesNote'
import { ScenarioSwitcher } from './ScenarioSwitcher'

/**
 * Props for the {@link HostedCompetitionsBoard} component.
 */
type HostedCompetitionsBoardProps = {
  /** Which competition a press made before signing in was aimed at, carried back by the return URL. */
  entryIntentId: string | undefined
}

/**
 * Every competition the program has run or will run, and the way into whichever one is open.
 */
export function HostedCompetitionsBoard({ entryIntentId }: HostedCompetitionsBoardProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Who is reading, and what the program knows about them
  const { reader, readerKey, isReaderKnown } = useEntryReader()

  // What stands between them and any entry
  const blocker = entryBlocker(reader)

  // Every competition the student can see
  const { view, uiState } = useHostedCompetitionsView(hasAccount(reader), readerKey, isReaderKnown)

  // The question standing between a press and a running clock
  const dialog = useHostedCompetitionEntryDialog(readerKey)

  // One clock for the page, so every deadline on it moves on the same tick
  const now = useNow()

  // Every group, most actionable first
  const groups = view === undefined ? [] : orderForReading(view.groups, now)

  // What a press turns into, given what the reader still owes
  const guardEntry = useEntryGuard({
    blocker,
    groups,
    openDialog: dialog.open,
    entryIntentId,
    hasView: view !== undefined,
  })

  // The list waits on who is reading as well as on its own fetch: drawn any earlier, a signed-in student
  // is offered the sign-in press
  const listState: QueryUiState = blocker === undefined ? { kind: 'loading' } : uiState

  return (
    // Hyphenation off: the global setting is for article prose, and the words here are names and labels
    <div className="mx-auto max-w-4xl hyphens-none">
      {/* What this page is, before anything can be pressed on it */}
      <div>
        <PageHeader title={t('title')} className="mb-0">
          <p>{t('intro')}</p>

          {/* What the thing is, which category to pick, and what an entry agrees to */}
          <div className="space-y-2">
            <HowItWorks />
            <CategoryLegend />
            <RulesNote />
          </div>

          {/* What the reader still owes, said before they reach for a button */}
          {blocker !== undefined && blocker !== null && <EntryGate blocker={blocker} />}
        </PageHeader>

        {/* Every mocked state, one press apart, for as long as the states are mocked */}
        <ScenarioSwitcher reader={reader} blocker={blocker} />
      </div>

      {/* The list, once there is one to draw */}
      <div className="mt-8 sm:mt-10">
        {listState.kind !== 'ready' || view === undefined || groups.length === 0 ? (
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
                onEnter={guardEntry}
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
          needsRulesAccept={reader.kind !== 'signedIn' || !reader.readiness.hasAcceptedRules}
          onClose={dialog.close}
          onConfirm={dialog.confirm}
          onForfeit={dialog.forfeit}
          isEntering={dialog.isEntering}
        />
      )}
    </div>
  )
}
