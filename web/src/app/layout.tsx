import './globals.css'
import 'katex/dist/katex.min.css'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import KatexSetup from '@/components/math/KatexSetup'
import ProgressBarProvider from '@/components/shared/providers/ProgressBarProvider'
import { QueryProvider } from '@/components/shared/providers/QueryProvider'
import { ToastProvider } from '@/components/shared/providers/ToastProvider'
import { cn } from '@/components/shared/utils/css-utils'
import { SITE_KEYWORDS, SITE_LANGUAGE, SITE_NAME, SITE_TITLE } from '@/constants/og-metadata'
import { generatePageMetadata, getCanonicalUrl } from '@/lib/metadata'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // Use our standard page metadata generation
  ...generatePageMetadata({}),

  // Root layout specific overrides
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  keywords: SITE_KEYWORDS,
  icons: { icon: '/icon.svg' },
  metadataBase: new URL(getCanonicalUrl()),
  manifest: '/manifest.json',
}

export const viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0f1f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE_LANGUAGE}>
      <body className={cn(inter.className, 'antialiased')}>
        <QueryProvider>
          <KatexSetup />
          <ProgressBarProvider>{children}</ProgressBarProvider>
        </QueryProvider>
        <ToastProvider />
      </body>
    </html>
  )
}
