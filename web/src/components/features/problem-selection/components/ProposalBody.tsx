'use client'

import type { ComponentProps, ReactNode } from 'react'

import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'

import type { Proposal } from '../model/selection-types'
import { ProposalStatement } from './ProposalStatement'
import { ProposalSurfaces } from './ProposalSurfaces'

/**
 * Props for the {@link ProposalBox} component.
 */
type ProposalBoxProps = Pick<ComponentProps<typeof SurfacePanel>, 'as' | 'className' | 'children'>

/**
 * The box a problem stands in, wherever it stands, so every problem's box has the same edges.
 */
export function ProposalBox({ as, className, children }: ProposalBoxProps) {
  return (
    <SurfacePanel as={as} radius="xl" className={cn('px-4 py-4 sm:px-5', className)}>
      {children}
    </SurfacePanel>
  )
}

/**
 * Props for the {@link ProposalBody} component.
 */
type ProposalBodyProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
  /** More rows after the hints and the solution. */
  children?: ReactNode
}

/**
 * What a problem's box holds: the statement, and rows under it for the hints, the solution and whatever else the
 * box offers. With no row to show, the statement stands alone.
 */
export function ProposalBody({ proposal, language, children }: ProposalBodyProps) {
  return (
    <>
      {/* The statement */}
      <ProposalStatement proposal={proposal} language={language} />

      {/* The rows, pulled out by their padding so that what a row says starts on the statement's left edge */}
      <div className="-mx-3 mt-4 flex flex-wrap gap-1 empty:hidden">
        <ProposalSurfaces proposal={proposal} language={language} />
        {children}
      </div>
    </>
  )
}
