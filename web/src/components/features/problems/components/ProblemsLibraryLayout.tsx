import type { ReactNode } from 'react'

/**
 * The sidebar's column, scrolling on its own with its scrollbar hidden, and only there once the viewport has room for
 * a sidebar.
 */
const SIDEBAR_COLUMN_CLASS =
  'hidden h-full flex-col overflow-y-auto lg:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'

/**
 * The props of {@link LibraryFrame}.
 */
type LibraryFrameProps = {
  /** What fills the page. */
  children: ReactNode
}

/**
 * The page the library fills: the whole window under the site's header, holding a centred column.
 */
export function LibraryFrame({ children }: LibraryFrameProps) {
  return (
    <div className="fixed inset-0 text-muted-foreground">
      <div className="flex h-full flex-col">
        {/* Room for the site's header */}
        <div className="h-14 sm:h-16 lg:h-20 flex-shrink-0" />

        {/* The library */}
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden p-2 sm:p-3 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

/**
 * The props of {@link LibraryColumns}.
 */
type LibraryColumnsProps = {
  /** What fills the sidebar. */
  sidebar: ReactNode
  /** What fills the bar over the list. */
  bar: ReactNode
  /** What fills the list. */
  list: ReactNode
}

/**
 * The library's columns: the filters in a sidebar once there is room for one, and beside them the bar over the list,
 * the list, and the mark closing it.
 */
export function LibraryColumns({ sidebar, bar, list }: LibraryColumnsProps) {
  return (
    <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-[var(--problems-sidebar-width)_1fr]">
      {/* Filters */}
      <aside className={SIDEBAR_COLUMN_CLASS}>{sidebar}</aside>

      {/* Problems */}
      <div className="flex flex-col overflow-hidden">
        {/* The bar */}
        <div className="mb-2 sm:mb-4 lg:mb-6 flex-shrink-0">{bar}</div>

        {/* The list */}
        <div className="relative flex-1 overflow-hidden">{list}</div>

        {/* The mark closing the list */}
        <div className="flex h-3 sm:h-4 lg:h-6 flex-shrink-0 items-end justify-center">
          <div className="h-1 w-8 rounded-full bg-foreground/10" />
        </div>
      </div>
    </div>
  )
}
