'use client'

import '@/app/globals.css'

import * as Sentry from '@sentry/nextjs'
import { Home, RotateCcw, TriangleAlert } from 'lucide-react'
import type { ErrorInfo } from 'next/error'
import { Inter } from 'next/font/google'
import { usePathname } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { useEffect } from 'react'

import { buttonVariants } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { type Locale, SUPPORTED_LOCALES, UNMATCHED_VISITOR_LOCALE } from '@/i18n/i18n'

/**
 * The page's font, the site's own.
 */
const inter = Inter({
  subsets: ['latin'],
})

/**
 * What the error page says, in one language.
 */
type GlobalErrorCopy = {
  /** The heading, and the tab's title */
  title: string

  /** The sentence under the heading */
  description: string

  /** The label of the button that renders the page again */
  retry: string

  /** The label of the link to the home page */
  home: string
}

/**
 * The error page's copy in every language. The page stands in for the root layout, so next-intl's
 * messages are not loaded when it renders, and importing them here would ship all three files.
 */
const COPY: Record<Locale, GlobalErrorCopy> = {
  sk: {
    title: 'Niečo sa pokazilo',
    description: 'Stránku sa nepodarilo zobraziť.',
    retry: 'Skúsiť znova',
    home: 'Domov',
  },
  cs: {
    title: 'Něco se pokazilo',
    description: 'Stránku se nepodařilo zobrazit.',
    retry: 'Zkusit znovu',
    home: 'Domů',
  },
  en: {
    title: 'Something went wrong',
    description: 'The page could not be shown.',
    retry: 'Try again',
    home: 'Home',
  },
}

/**
 * The page shown when rendering fails anywhere, in place of the whole site. It reports a fault the
 * browser threw, since defining this page stops Next.js from passing such faults on.
 */
export default function GlobalError({ error, unstable_retry }: ErrorInfo) {
  // The reader's language, from the address, which always starts with one
  const pathSegment = usePathname().split('/')[1]
  const locale = hasLocale(SUPPORTED_LOCALES, pathSegment) ? pathSegment : UNMATCHED_VISITOR_LOCALE

  // The copy in that language
  const copy = COPY[locale]

  // Report the fault the page is showing
  useEffect(() => {
    // A server fault carries the digest Next.js gave it, and was reported where it happened
    if (!('digest' in error)) {
      Sentry.captureException(error)
    }
  }, [error])

  // The page replaces the root layout, so it carries its own document
  return (
    <html lang={locale}>
      <body className={cn(inter.className, 'antialiased text-foreground')}>
        <title>{copy.title}</title>
        <main className="min-h-screen flex items-center justify-center px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            {/* Icon */}
            <TriangleAlert className="mx-auto mb-4 sm:mb-6 size-16 sm:size-20" aria-hidden />

            {/* Title */}
            <h1 className="text-4xl sm:text-6xl font-black leading-tight sm:leading-none tracking-tight mb-4 sm:mb-6">
              {copy.title}
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-muted-foreground mb-6">{copy.description}</p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={unstable_retry}
                className={buttonVariants({ variant: 'primary' })}
              >
                <RotateCcw size={20} aria-hidden />
                {copy.retry}
              </button>
              <a href={`/${locale}`} className={buttonVariants({ variant: 'secondary' })}>
                <Home size={20} aria-hidden />
                {copy.home}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
