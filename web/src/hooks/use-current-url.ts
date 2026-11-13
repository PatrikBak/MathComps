import type { ReadonlyURLSearchParams } from 'next/navigation'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Result of the {@link useCurrentUrl} hook.
 */
type UseCurrentUrlResult = {
  /**
   * The page's path with its query string, as rendered. It carries no fragment, which the server
   * never sees and nothing re-renders on, so it is safe to read during render.
   */
  pathWithQuery: string
  /**
   * Reads the page's full relative address, fragment included. The fragment is read from the
   * address bar at the moment of the call, so it is for event handlers and effects, never render.
   *
   * @returns The path with its query string and fragment.
   */
  getCurrentUrl: () => string
}

/**
 * A custom hook that reconstructs the current URL path including search parameters.
 *
 * This is useful for scenarios where you need the full relative URL,
 * such as for redirecting back to the current page after an action (e.g., login/logout).
 *
 * This hook is safe to use in pages with generateStaticParams - during static generation,
 * search params will be ignored (as they don't exist at build time).
 *
 * @returns The page's address as rendered, and a function reading it with its fragment.
 */
export function useCurrentUrl(): UseCurrentUrlResult {
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

  // The search parameters as a string, empty when there are none or they can't be read
  const search = searchParams?.toString() || ''

  // The pathname with the query appended when there is one
  const pathWithQuery = search ? `${pathname}?${search}` : pathname

  // A function which reads the address with the fragment the address bar holds right now
  const getCurrentUrl = useCallback(
    () => `${pathWithQuery}${window.location.hash}`,
    [pathWithQuery]
  )

  // Return the address as rendered and its reader
  return { pathWithQuery, getCurrentUrl }
}
