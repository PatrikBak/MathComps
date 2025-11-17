import { AnchorScrollHandler } from '@/components/shared/components/AnchorScrollHandlers'
import { cn } from '@/components/shared/utils/css-utils'

import { MobileTableOfContents } from '../table-of-contents/MobileTableOfContents'
import type { TableOfContentsItem } from '../table-of-contents/table-of-contents-types'
import { TableOfContents } from '../table-of-contents/TableOfContents'
import Footer from './Footer'
import Header from './Header'

/**
 * Props for the Layout component.
 */
type LayoutProps = {
  /** The content to be rendered within the layout */
  children?: React.ReactNode
  /** Optional CSS class for the root layout container */
  className?: string
  /** Whether to display the footer at the bottom of the page */
  displayFooter?: boolean
  /** Table of contents items - when provided, renders a 2-column layout with desktop TOC sidebar and mobile TOC navigation */
  tocItems?: TableOfContentsItem[]
  /** Whether to vertically and horizontally center the content in the viewport (useful for full-screen pages like 404) */
  centerMidscreen?: boolean
}

/**
 * Root layout component that provides consistent page structure across the application.
 * Includes header, main content area, optional table of contents, and optional footer.
 * Supports two layout modes: standard content layout and centered full-screen layout.
 */
export default function Layout({
  children,
  className,
  tocItems,
  displayFooter = true,
  centerMidscreen = false,
}: LayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col', className)}>
      {/* Makes sure footer links will properly scroll */}
      <AnchorScrollHandler />

      {/* Sticky header */}
      <Header />

      {/* Body */}
      <main
        className={cn(
          'mx-auto flex-1 w-full ',
          // Handle screen centering
          centerMidscreen && !tocItems
            ? 'flex items-center justify-center'
            : 'px-4 sm:px-6 md:px-8 pb-6 sm:pb-10 md:pb-12 pt-4 sm:pt-6 md:pt-8 lg:pt-12',
          // Screen with toc should be wider
          tocItems !== undefined ? 'max-w-[min(100%,80rem)]' : 'max-w-[min(100%,70rem)]'
        )}
      >
        {tocItems ? (
          // Toc Layout
          <>
            {/* 2-column layout */}
            <div className="lg:grid lg:grid-cols-[9fr_280px] lg:gap-8">
              {/* Main content */}
              <div>{children}</div>

              {/* Desktop TOC */}
              <aside>
                <TableOfContents items={tocItems} />
              </aside>
            </div>

            {/* Mobile TOC */}
            <MobileTableOfContents items={tocItems} />
          </>
        ) : (
          // Layout without toc
          children
        )}
      </main>

      {/* Optional footer */}
      {displayFooter && <Footer hasToc={tocItems !== undefined} />}
    </div>
  )
}
