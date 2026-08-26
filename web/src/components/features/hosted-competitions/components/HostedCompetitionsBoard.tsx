'use client'

import { useTranslations } from 'next-intl'

import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { PageHeader } from '@/components/shared/components/PageHeader'
import { useNow } from '@/hooks/use-now'
import type { QueryUiState } from '@/lib/query-ui-state'

import { useDismissProfilePrompt } from '../hooks/use-dismiss-profile-prompt'
import { useEntryGuard } from '../hooks/use-entry-guard'
import { useEntryReader } from '../hooks/use-entry-reader'
import { useHostedCompetitionEntryDialog } from '../hooks/use-hosted-competition-entry-dialog'
import { useHostedCompetitionsView } from '../hooks/use-hosted-competitions-view'
import { headerBlocker } from '../model/entry-reader'
import { orderForReading } from '../model/hosted-competition-state'
import { CategoryLegend } from './CategoryLegend'
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
  /** Which competition a press made before signing in was aimed at, carried back by the return URL. */
  entryIntentId: string | undefined
}

/**
 * Every competition the program has run or will run, and the way into whichever one is open.
 */
export function HostedCompetitionsBoard({ entryIntentId }: HostedCompetitionsBoardProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The page's own name and description
  const tPage = useTranslations('pages.competitions')

  // Who is reading, and what the program knows about them
  const { reader, readerKey, isReaderKnown } = useEntryReader()

  // Every competition the student can see
  const { view, uiState } = useHostedCompetitionsView(readerKey, isReaderKnown)

  // The question standing between a press and a running clock
  const dialog = useHostedCompetitionEntryDialog(readerKey)

  // One clock for the page, so every deadline on it moves on the same tick
  const now = useNow()

  // Every group, most actionable first
  const groups = view === undefined ? [] : orderForReading(view.groups, now)

  // What a press turns into, given what the group they pressed asks of them
  const guardEntry = useEntryGuard({
    reader,
    groups,
    openDialog: dialog.open,
    entryIntentId,
    hasView: view !== undefined,
  })

  // The list waits on who is reading as well as on its own fetch: drawn any earlier, a signed-in student
  // is offered the sign-in press
  const listState: QueryUiState = reader.kind === 'unknown' ? { kind: 'loading' } : uiState

  // Hiding the profile sentence for good
  const { dismissProfilePrompt } = useDismissProfilePrompt(readerKey)

  // The step the header names, if there is one
  const gateBlocker = headerBlocker(reader, groups)

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
            <RulesList />
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
