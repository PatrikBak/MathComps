import './globals.css'
import 'katex/dist/katex.min.css'

import { AlertCircle, AlertTriangle, Check, Info, WifiOff } from 'lucide-react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'

import KatexSetup from '@/components/math/KatexSetup'
import { QueryProvider } from '@/components/shared/providers/QueryProvider'
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
          {children}
        </QueryProvider>
        <Toaster
          position="bottom-center"
          closeButton
          icons={{
            success: <Check className="h-5 w-5" />,
            error: <AlertCircle className="h-5 w-5" />,
            info: <Info className="h-5 w-5" />,
            warning: <AlertTriangle className="h-5 w-5" />,
            loading: <WifiOff className="h-5 w-5 animate-pulse" />,
          }}
          toastOptions={{
            unstyled: false,
            classNames: {
              toast: 'group',
              title: 'hyphens-none break-words',
            },
          }}
          gap={8}
        />
      </body>
    </html>
  )
}
