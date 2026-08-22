import '@/app/globals.css'

import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { notFound } from 'next/navigation'
import { hasLocale, type Locale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { type ReactNode, Suspense } from 'react'

import KatexSetup from '@/components/math/KatexSetup'
import { AuthStoreSync } from '@/components/shared/auth/AuthStoreSync'
import { JsonLd } from '@/components/shared/components/JsonLd'
import { OfflineIndicator } from '@/components/shared/components/OfflineIndicator'
import ProgressBarProvider from '@/components/shared/providers/ProgressBarProvider'
import { QueryProvider } from '@/components/shared/providers/QueryProvider'
import { ToastProvider } from '@/components/shared/providers/ToastProvider'
import { cn } from '@/components/shared/utils/css-utils'
import { getCanonicalUrl } from '@/components/shared/utils/url-utils'
import { SITE_NAME, SITE_THEME_COLOR, SITE_TITLE } from '@/constants/og-metadata'
import { DEFAULT_LOCALE, routing, SUPPORTED_LOCALES } from '@/i18n/i18n'
import { generatePageMetadata, getSiteMetadata } from '@/lib/metadata'
import { buildSiteJsonLd } from '@/lib/structured-data'

/**
 * Root font configuration.
 */
const inter = Inter({
  subsets: ['latin'],
})

/**
 * Generates root layout metadata with locale-aware values.
 *
 * @param params - The route params containing the locale.
 *
 * @returns The root metadata for the given locale.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Get the locale from params
  const { locale: localeString } = await params

  // Cast to our custom type, or the default locale if language is unknown
  const locale = (localeString as Locale) ?? DEFAULT_LOCALE

  // Get locale-aware site metadata
  const siteMetadata = await getSiteMetadata(locale)

  // Return the root metadata
  return {
    // Use our standard page metadata generation with locale
    ...generatePageMetadata({ locale, description: siteMetadata.description }),

    // Root layout specific overrides
    title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
    icons: { icon: '/icon.svg' },
    metadataBase: new URL(getCanonicalUrl()),
  }
}

/**
 * Root viewport.
 */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: SITE_THEME_COLOR,
}

/**
 * Ensure static website generation for all locales.
 *
 * @returns The locale route params that should be SSR-ed.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

/**
 * Props for the {@link LocaleLayout} component.
 */
type LayoutProps = {
  /** The children wrapped by the layout. */
  children: ReactNode
  /** The current locale. */
  params: Promise<{ locale: string }>
}

/**
 * Locale-aware wrapper of every page
 */
export default async function LocaleLayout({ children, params }: LayoutProps) {
  // Get the current locale from the /locale/path
  const { locale: localeString } = await params

  // Cast the locale to our type
  const locale = (localeString as Locale) ?? DEFAULT_LOCALE

  // Validate the locale - trigger 404 for invalid ones
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Pin the locale for this render. next-intl otherwise resolves it from the request headers, which
  // a static render cannot answer.
  setRequestLocale(locale)

  // Locale-aware site metadata
  const siteMetadata = await getSiteMetadata(locale)

  // Localized author bio
  const tAuthor = await getTranslations({ locale, namespace: 'about.author' })

  // Here's the HTML: the JSON-LD up front, then our layout and 42 nested providers under one
  // Suspense. The boundary is what covers the header reading the request's query: an uncached read
  // needs one above it or the build refuses the route outright.
  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={cn(inter.className, 'antialiased')}>
        <JsonLd
          data={buildSiteJsonLd({
            locale,
            siteDescription: siteMetadata.description,
            authorDescription: tAuthor('shortBio'),
          })}
        />
        <Suspense fallback={null}>
          <ClerkProvider>
            <QueryProvider>
              <NextIntlClientProvider locale={locale}>
                <KatexSetup />
                <ProgressBarProvider>{children}</ProgressBarProvider>
                <OfflineIndicator />
              </NextIntlClientProvider>
            </QueryProvider>
            <ToastProvider />
            <AuthStoreSync />
          </ClerkProvider>
        </Suspense>
      </body>
    </html>
  )
}
