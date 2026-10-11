'use client'

import { type ReactNode, useState } from 'react'

import { type TabItem, Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

import { DETAIL_HEADING_ATTRIBUTE } from '../hooks/use-open-detail'
import { type DetailPage, detailQuery, PAGE_PARAMS, tabOf } from '../model/selection-routes'
import { BackLink } from './SelectionLinks'

/**
 * Props for the {@link DetailHeading} component.
 */
type DetailHeadingProps = {
  /** The page's subject. */
  subjectId: string
  /** How the page sets its name, beside what every page's name shares. */
  className: string
  /** The name. */
  children: ReactNode
}

/**
 * The name of a page open over the pool, which focus moves to as the page opens, so a reader's next Tab goes on
 * from it.
 */
export function DetailHeading({ subjectId, className, children }: DetailHeadingProps) {
  return (
    <h2
      tabIndex={-1}
      {...DETAIL_HEADING_ATTRIBUTE.stamp(subjectId)}
      className={cn('text-lg font-semibold hyphens-none focus:outline-none sm:text-xl', className)}
    >
      {children}
    </h2>
  )
}

/**
 * Props for the {@link DetailMissing} component.
 */
type DetailMissingProps = {
  /** The line saying the subject is not there. */
  message: string
}

/**
 * A page whose subject the selection does not hold: the way back, and a line saying so.
 */
export function DetailMissing({ message }: DetailMissingProps) {
  return (
    <div className="space-y-3">
      <BackLink />
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}

/**
 * What one tab of a page holds.
 */
export type DetailTabContent<TTab extends string> = Omit<TabItem<TTab>, 'id'>

/**
 * Props for the {@link DetailTabs} component.
 */
type DetailTabsProps<TTab extends string> = {
  /** Accessible name for the strip of tabs. */
  ariaLabel: string
  /** The page's tabs in the order they read, the first being the one it opens on by default. */
  tabs: readonly [TTab, ...TTab[]]
  /** What each tab holds. */
  contents: Record<TTab, DetailTabContent<TTab>>
  /** Gives the page on a tab. */
  pageOn: (tab: TTab) => DetailPage
}

/**
 * A page's tabs, opening on the one the address names. The address keeps naming the tab on screen, so a link copied
 * from it opens the same one, every parameter the page does not write left as it stands.
 */
export function DetailTabs<TTab extends string>({
  ariaLabel,
  tabs,
  contents,
  pageOn,
}: DetailTabsProps<TTab>) {
  // The tab the address opened the page on, the first when it names none
  const addressedTab = useInitialUrlState((params) => tabOf(params, tabs))

  // The tab showing, the addressed one at first
  const [tab, setTab] = useState<TTab>(addressedTab)

  // The page on the tab showing
  const page = pageOn(tab)

  // Keep the address naming the page and its tab
  useAddressSync(detailQuery(page), PAGE_PARAMS[page.kind])

  return (
    <Tabs
      ariaLabel={ariaLabel}
      selectedId={tab}
      onSelect={setTab}
      items={tabs.map((id) => ({ id, ...contents[id] }))}
    />
  )
}
