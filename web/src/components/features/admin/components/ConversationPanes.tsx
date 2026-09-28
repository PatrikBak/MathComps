'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { type TabItem, Tabs } from '@/components/shared/components/Tabs'

import type {
  ConversationPanelId,
  SidePanelId,
  UseConversationPanelsResult,
} from '../hooks/use-conversation-panels'

/**
 * One of a surface's own panels, read beside the conversation.
 */
type OwnPanel = Omit<TabItem<string>, 'id'>

/**
 * Props for the {@link ConversationPanes} component.
 */
type ConversationPanesProps<TOwn extends string> = {
  /** How much stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult<TOwn>
  /** The conversation itself. */
  transcript: ReactNode
  /** A count shown on the conversation's tab; null when it carries none. */
  transcriptCount: number | null
  /** The solution the conversation is judged against, as a pane that names itself. */
  reference: ReactNode
  /** The surface's own panels, by the id each is picked by. */
  ownPanels: Record<TOwn, OwnPanel>
}

/**
 * The parts a conversation is read in, laid out by the room the viewport gives.
 *
 * Everything is a tab where a split would leave neither half readable. Where there is room, the conversation
 * stands on its own with the rest as tabs beside it, and where there is more still the reference takes a column
 * of its own, since what was said is judged against it. A side column left holding one panel shows it bare, since
 * a single tab offers no choice.
 */
export function ConversationPanes<TOwn extends string>({
  panels,
  transcript,
  transcriptCount,
  reference,
  ownPanels,
}: ConversationPanesProps<TOwn>) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // A function which builds the tab of one side panel, the reference being the one every surface shares
  const sideTabOf = (id: SidePanelId<TOwn>): TabItem<ConversationPanelId<TOwn>> =>
    id === 'reference'
      ? { id, label: t('tabs.reference'), count: null, panel: reference }
      : { id, ...ownPanels[id] }

  // The side panels that are tabs, in order
  const sideTabs = panels.sideTabIds.map(sideTabOf)

  // Narrow: everything is a tab
  if (!panels.isSplit) {
    return (
      <Tabs<ConversationPanelId<TOwn>>
        ariaLabel={t('tabsLabel')}
        selectedId={panels.selectedTabId}
        onSelect={panels.selectTab}
        items={[
          {
            id: 'conversation',
            label: t('tabs.conversation'),
            count: transcriptCount,
            panel: transcript,
          },
          ...sideTabs,
        ]}
      />
    )
  }

  // Wide: the transcript and whatever is read or written against it, side by side
  return (
    <div className="flex min-h-0 flex-1 flex-row">
      {/* The conversation */}
      {transcript}

      {/* The solution in a column of its own, once there is room for one. The pane inside carries the name,
          so the column around it is layout and nothing else */}
      {panels.hasReferenceColumn && (
        <div className="flex min-h-0 w-[26rem] shrink-0 flex-col border-l border-foreground/10">
          {reference}
        </div>
      )}

      {/* Everything else read or written against it */}
      <div className="flex min-h-0 w-[28rem] shrink-0 flex-col border-l border-foreground/10">
        {sideTabs.length === 1 ? (
          sideTabs[0].panel
        ) : (
          <Tabs<ConversationPanelId<TOwn>>
            ariaLabel={t('tabsLabel')}
            selectedId={panels.sideTabId}
            onSelect={panels.selectTab}
            items={sideTabs}
          />
        )}
      </div>
    </div>
  )
}
