import { createContext, use } from 'react'

/** The slug of the organization whose selection is on screen, null outside one. */
export const SelectionOrganizationContext = createContext<string | null>(null)

/**
 * Reads the slug of the organization whose selection is on screen. Throws outside a selection's provider.
 *
 * @returns The organization's slug.
 */
export function useSelectionOrganization(): string {
  // The organization from the nearest selection
  const organization = use(SelectionOrganizationContext)

  // Read outside a selection, which is a bug in the tree
  if (organization === null) {
    throw new Error('useSelectionOrganization outside SelectionWorkspaceProvider')
  }

  // The organization's slug
  return organization
}
