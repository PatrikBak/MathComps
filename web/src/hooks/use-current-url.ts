import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

/**
 * A custom hook that reconstructs the current URL path including search parameters.
 *
 * This is useful for scenarios where you need the full relative URL,
 * such as for redirecting back to the current page after an action (e.g., login/logout).
 *
 * @returns A function that returns the current pathname with the query string appended (if present).
 */
export function useCurrentUrl() {
  // Get the current URL parts
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Return a function that returns the full URL
  return useCallback(() => {
    // Get the search parameters as a string
    const search = searchParams.toString()

    // Append them to the pathname if they exist
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])
}
