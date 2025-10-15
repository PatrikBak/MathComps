import { AnchorScrollHandler } from '@/components/shared/components/AnchorScrollHandlers'
import { cn } from '@/components/shared/utils/css-utils'

import Footer from './Footer'
import Header from './Header'

type LayoutProps = {
  children: React.ReactNode
  className?: string
  displayFooter?: boolean
}

export default function Layout({ children, className, displayFooter = true }: LayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col text-slate-300 antialiased', className)}>
      {/* Makes sure footer links will properly scroll */}
      <AnchorScrollHandler />
      <Header />
      <main className="flex-1">{children}</main>
      {displayFooter && <Footer />}
    </div>
  )
}
