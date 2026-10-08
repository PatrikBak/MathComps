'use client'

import { createContext, type ReactNode, use, useMemo } from 'react'

import { CommentCountProvider } from '@/components/features/comments/components/CommentCountContext'

import {
  type LoadedSelection,
  type SelectionWorkspace,
  useSelectionWorkspaceState,
} from '../hooks/use-selection-workspace-state'

/** The selection's shared state, null outside a provider. */
const SelectionWorkspaceContext = createContext<SelectionWorkspace | null>(null)

/**
 * Props for the {@link SelectionWorkspaceProvider} component.
 */
type SelectionWorkspaceProviderProps = {
  /** Everything the selection's shared state is handed to. */
  children: ReactNode
}

/**
 * A provider holding the selection's shared state for everything inside it, with how many comments each problem's
 * discussion holds, read for every problem at once.
 */
export function SelectionWorkspaceProvider({ children }: SelectionWorkspaceProviderProps) {
  // The selection's shared state
  const workspace = useSelectionWorkspaceState()

  // The id of every problem the selection holds; none until it arrives
  const proposalIds = useMemo(
    () => (workspace.selection === null ? [] : [...workspace.selection.proposalsById.keys()]),
    [workspace.selection]
  )

  // The selection's shared state, handed to everything inside with the problems' comment counts
  return (
    <SelectionWorkspaceContext value={workspace}>
      <CommentCountProvider targetType="Proposal" targetIds={proposalIds}>
        {children}
      </CommentCountProvider>
    </SelectionWorkspaceContext>
  )
}

/**
 * Reads the selection's shared state from the nearest {@link SelectionWorkspaceProvider}. Throws outside one.
 *
 * @returns The selection's shared state.
 */
export function useSelectionWorkspace(): SelectionWorkspace {
  // The workspace from the nearest provider
  const workspace = use(SelectionWorkspaceContext)

  // Read outside the provider, which is a bug in the tree
  if (workspace === null) {
    throw new Error('useSelectionWorkspace outside SelectionWorkspaceProvider')
  }

  // The selection's shared state
  return workspace
}

/**
 * The selection, for a part drawn only once its read has landed. Throws before then.
 *
 * @returns The loaded selection.
 */
export function useLoadedSelection(): LoadedSelection {
  // The selection, if its read has landed
  const { selection } = useSelectionWorkspace()

  // Drawn before the read landed, which is a bug in whatever drew it
  if (selection === null) {
    throw new Error('useLoadedSelection before the selection arrived')
  }

  // The loaded selection
  return selection
}
