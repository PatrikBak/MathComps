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
 * One of the panels read beside the conversation, named by the panes themselves.
 */
type SidePanel = Omit<TabItem<SidePanelId>, 'id' | 'label'>

/**
 * Props for the {@link ConversationPanes} component.
 */
type ConversationPanesProps = {
  /** How much stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult
  /** The conversation itself. */
  transcript: ReactNode
  /** A count shown on the conversation's tab; null when it carries none. */
  transcriptCount: number | null
  /**
   * The panels read beside the conversation, by the id each is picked by; one shows only where the layout gives
   * it a tab or a column.
   */
  sidePanels: Record<SidePanelId, SidePanel>
}

/**
 * The parts a conversation is read in, laid out by the room the viewport gives.
 *
 * Everything is a tab where a split would leave neither half readable. Where there is room, the conversation
 * stands on its own with the rest as tabs beside it, and where there is more still the reference takes a column
 * of its own, since what was said is judged against it.
 */
export function ConversationPanes({
  panels,
  transcript,
  transcriptCount,
  sidePanels,
}: ConversationPanesProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // Grades copy
  const tGrades = useTranslations('admin.grades')

  // Notes copy
  const tNotes = useTranslations('admin.notes')

  // What each side panel's tab is called
  const sideLabels: Record<SidePanelId, string> = {
    grade: tGrades('tab'),
    feedback: t('tabs.feedback'),
    reference: t('tabs.reference'),
    notes: tNotes('tab'),
    config: t('tabs.config'),
  }

  // The side panels that are tabs, in order
  const sideTabs = panels.sideTabIds.map(
    (id): TabItem<SidePanelId> => ({ id, label: sideLabels[id], ...sidePanels[id] })
  )

  // Narrow: everything is a tab
  if (!panels.isSplit) {
    return (
      <Tabs<ConversationPanelId>
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
          {sidePanels.reference.panel}
        </div>
      )}

      {/* Everything else read or written against it, wide enough for every tab's name in every language */}
      <div className="flex min-h-0 w-[34rem] shrink-0 flex-col border-l border-foreground/10">
        <Tabs<SidePanelId>
          ariaLabel={t('tabsLabel')}
          selectedId={panels.sideTabId}
          onSelect={panels.selectTab}
          items={sideTabs}
        />
      </div>
    </div>
  )
}
