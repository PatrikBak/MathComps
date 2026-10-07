'use client'

import { createContext, type ReactNode, use } from 'react'

import {
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
 * A provider holding the selection's shared state for everything inside it.
 */
export function SelectionWorkspaceProvider({ children }: SelectionWorkspaceProviderProps) {
  // The selection's shared state
  const workspace = useSelectionWorkspaceState()

  // The selection's shared state, handed to everything inside
  return <SelectionWorkspaceContext value={workspace}>{children}</SelectionWorkspaceContext>
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
