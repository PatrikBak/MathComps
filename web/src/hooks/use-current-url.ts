import type { ReadonlyURLSearchParams } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { usePathname } from '@/i18n/navigation'

/**
 * A custom hook that reconstructs the current URL path including search parameters.
 *
 * This is useful for scenarios where you need the full relative URL,
 * such as for redirecting back to the current page after an action (e.g., login/logout).
 *
 * This hook is safe to use in pages with generateStaticParams - during static generation,
 * search params will be ignored (as they don't exist at build time).
 *
 * @returns A function that returns the current pathname with the query string appended (if present).
 */
export function useCurrentUrl() {
  // Get the current URL parts
  const pathname = usePathname()

  // Use try/catch to handle cases where useSearchParams might throw during static generation
  // By catching the error, we gracefully degrade to just the pathname
  let searchParams: ReadonlyURLSearchParams | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams()
  } catch {
    // During static generation or if Suspense is missing, this will throw
    // We'll just use the pathname without search params
  }

  // Return a function that returns the full URL
  return useCallback(() => {
    // Get the search parameters as a string (if available)
    const search = searchParams?.toString() || ''

    // Append them to the pathname if they exist
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])
}
