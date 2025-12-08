import { cn } from '@/components/shared/utils/css-utils'

import { MobileTableOfContents } from '../table-of-contents/MobileTableOfContents'
import type { TableOfContentsItem } from '../table-of-contents/table-of-contents-types'
import { TableOfContents } from '../table-of-contents/TableOfContents'
import Footer from './Footer'
import ServerHeader from './ServerHeader'

/**
 * Props for the {@link Layout} component.
 */
type LayoutProps = {
  /** The content rendered within the {@link Layout} shell */
  children: React.ReactNode
  /** Optional CSS class applied to the {@link Layout} root container */
  className?: string
  /** Whether to display the {@link Footer} at the bottom of the page */
  displayFooter?: boolean
  /** Table of contents items for {@link TableOfContents} and {@link MobileTableOfContents} */
  tocItems?: TableOfContentsItem[]
  /** Whether to center the content when no {@link TableOfContents} is provided */
  centerMidscreen?: boolean
  /** Whether to use wider layout. This is automatically true if {@link tocItems} is provided */
  wider?: boolean
}

/**
 * Root layout component that wires together {@link ServerHeader}, {@link AnchorScrollHandler},
 * {@link TableOfContents}, and {@link Footer} to provide consistent page structure.
 */
export default function Layout({
  children,
  className,
  tocItems,
  displayFooter = true,
  centerMidscreen = false,
  wider = false,
}: LayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col', className)}>
      {/* Sticky header */}
      <ServerHeader />

      {/* Body */}
      <main
        className={cn(
          'mx-auto flex-1 w-full ',
          // Handle screen centering
          centerMidscreen && !tocItems
            ? 'flex items-center justify-center'
            : 'px-4 sm:px-6 md:px-8 pb-6 sm:pb-10 md:pb-12 pt-4 sm:pt-6 md:pt-8 lg:pt-12',
          // Screen with toc should be wider
          wider || tocItems !== undefined ? 'max-w-[min(100%,80rem)]' : 'max-w-[min(100%,70rem)]'
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
