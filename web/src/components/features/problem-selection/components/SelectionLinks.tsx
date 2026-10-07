'use client'

import type { ComponentProps } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { isPlainClick } from '@/components/shared/utils/event-utils'
import { ROUTES } from '@/i18n/i18n'

import { proposalHref } from '../model/selection-routes'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props every selection link takes: anything an {@link AppLink} takes except where it goes, what a click does
 * and whether it prefetches, which each link sets itself.
 */
type SelectionLinkBaseProps = Omit<ComponentProps<typeof AppLink>, 'href' | 'onClick' | 'prefetch'>

/**
 * Props for the {@link SelectionLink} component.
 */
type SelectionLinkProps = SelectionLinkBaseProps & {
  /** Where the link goes when the browser follows it. */
  href: ComponentProps<typeof AppLink>['href']
  /** What a plain click does, in place of following the link. */
  onPlainClick: () => void
}

/**
 * A link a plain click acts on without leaving the page. A click held with a modifier is left to the browser,
 * which opens it in a new tab or window.
 */
function SelectionLink({ href, onPlainClick, ...rest }: SelectionLinkProps) {
  return (
    <AppLink
      href={href}
      // A plain click stays on this page, so there is nothing to fetch ahead
      prefetch={false}
      onClick={(event) => {
        // A click held with a modifier is left to the browser
        if (!isPlainClick(event)) return

        // The link itself is not followed
        event.preventDefault()

        // The page acts on the click instead
        onPlainClick()
      }}
      {...rest}
    />
  )
}

/**
 * Props for the {@link ProposalLink} component.
 */
type ProposalLinkProps = SelectionLinkBaseProps & {
  /** The problem the link opens. */
  proposalId: string
}

/**
 * A link that opens a problem in full without leaving the page.
 */
export function ProposalLink({ proposalId, ...rest }: ProposalLinkProps) {
  // A function which opens a problem in full over the pool
  const { openProposal } = useSelectionWorkspace()

  return (
    <SelectionLink
      href={proposalHref(proposalId)}
      onPlainClick={() => openProposal(proposalId)}
      {...rest}
    />
  )
}

/**
 * A link back to the pool.
 */
export function PoolLink(props: SelectionLinkBaseProps) {
  // A function which goes back to the pool
  const { closeProposal } = useSelectionWorkspace()

  // A link to the pool's route
  return <SelectionLink href={ROUTES.PROBLEM_SELECTION} onPlainClick={closeProposal} {...props} />
}
