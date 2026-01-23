import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'

import type { Locale } from './i18n'

/**
 * Base props injected by {@link withLocale} into wrapped page components.
 * Pages can destructure `locale` if needed, or simply ignore it.
 */
type LocaleProps = {
  /** Current locale extracted from URL params (e.g., 'en', 'sk'). */
  locale: Locale
}

/**
 * Standard props that Next.js passes to page components in `[locale]` route segments.
 *
 * @template TParams - Additional route params beyond `locale` (e.g., `{ slug: string }`).
 */
export type PageProps<TParams = object> = {
  /** Route parameters including locale. Async because Next.js 15+ uses Promise-based params. */
  params: Promise<TParams & { locale: string }>
  /** Query string parameters. Optional since not all pages use search params. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  /** Resolved locale value - available after {@link withLocale} processes the params. */
  locale: Locale
}

/**
 * Higher-order function that wraps a page component to handle locale setup.
 *
 * **What it does:**
 * 1. Extracts `locale` from the async route params
 * 2. Calls `setRequestLocale()` to configure next-intl for server components
 * 3. Passes the resolved `locale` prop to your page component
 *
 * @param PageComponent - Your page component (sync or async).
 *
 * @returns Wrapped component that handles locale setup automatically.
 */
export function withLocale<P extends LocaleProps>(
  PageComponent: (props: P) => ReactNode | Promise<ReactNode>
) {
  return async function WrappedPage({ params, ...rest }: Omit<PageProps, 'locale'>) {
    // Resolve the current locale from the params
    const { locale } = await params

    // Configure next-intl for server components
    setRequestLocale(locale as Locale)

    // Pass the locale and any other props to the wrapped component
    return PageComponent({ locale: locale as Locale, params, ...rest } as unknown as P)
  }
}
