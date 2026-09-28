import { useCallback } from 'react'

import { useMinWidth } from '@/hooks/use-breakpoint'
import { useKeyedState } from '@/hooks/use-keyed-state'

/**
 * A part that can stand beside a conversation rather than in place of it: the solution it is judged against, or
 * one of the surface's own panels.
 */
export type SidePanelId<TOwn extends string> = 'reference' | TOwn

/**
 * One of the parts a conversation is read in. The conversation itself is never beside anything, since it is what
 * the others are read against.
 */
export type ConversationPanelId<TOwn extends string> = 'conversation' | SidePanelId<TOwn>

/**
 * What {@link useConversationPanels} hands back.
 */
export type UseConversationPanelsResult<TOwn extends string> = {
  /** Which part of the conversation the reader picked last. */
  selectedTabId: ConversationPanelId<TOwn>
  /** Which of the side panels is showing, which is never the conversation or a panel with a column of its own. */
  sideTabId: SidePanelId<TOwn>
  /** The side panels that are tabs, in the order they read. */
  sideTabIds: SidePanelId<TOwn>[]
  /** Shows another part. */
  selectTab: (tabId: ConversationPanelId<TOwn>) => void
  /** Whether there is room to stand the transcript and the side panels next to each other. */
  isSplit: boolean
  /** Whether there is room for the reference to stop being a tab and simply stay on screen. */
  hasReferenceColumn: boolean
  /** Puts the reader back on the conversation. */
  reset: () => void
}

/**
 * Decides how much of a conversation stands on screen at once, and which part the reader is looking at.
 *
 * Which part stands beside the conversation is not simply the part the reader picked, since what the viewport
 * can give changes which parts are tabs at all: a reader who picked the reference on a narrow screen is looking
 * straight at it on a wide one, so the side falls to the first tab left.
 *
 * @param sidePanelIds - Every side panel, the reference among them, in the order its tab reads.
 * @param resetKey - What the reader's pick belongs to: a new one starts back on the conversation, and one held
 * the same across the whole dialog keeps the pick as the reader moves on.
 *
 * @returns The layout as described by {@link UseConversationPanelsResult}.
 */
export function useConversationPanels<TOwn extends string>(
  sidePanelIds: readonly SidePanelId<TOwn>[],
  resetKey: string | null
): UseConversationPanelsResult<TOwn> {
  // The part the reader picked, back on the conversation whenever the reset key changes
  const [selectedTabId, setSelectedTabId] = useKeyedState<ConversationPanelId<TOwn>>(
    resetKey,
    'conversation'
  )

  // The dialog runs to 72rem, so the split only earns its place once the viewport can actually give it that
  const isSplit = useMinWidth('xl')

  // Whether the reference can stay on screen, so judging the conversation doesn't hide the very thing the
  // judgement is made from
  const hasReferenceColumn = useMinWidth('2xl')

  // The side panels that are still tabs, the reference dropping out once it has a column
  const sideTabIds = sidePanelIds.filter((id) => !hasReferenceColumn || id !== 'reference')

  // The side panel showing: the one picked while it is still a tab, and the first tab otherwise
  const sideTabId = sideTabIds.find((id) => id === selectedTabId) ?? sideTabIds[0]

  // A function which puts the reader back on the conversation
  const reset = useCallback(() => setSelectedTabId('conversation'), [setSelectedTabId])

  // What stands on screen, and the way to show something else
  return {
    selectedTabId,
    sideTabId,
    sideTabIds,
    selectTab: setSelectedTabId,
    isSplit,
    hasReferenceColumn,
    reset,
  }
}
