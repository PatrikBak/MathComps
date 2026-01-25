import { useCallback } from 'react'

import { useCurrentUrl } from '@/hooks/use-current-url'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

/**
 * Result of the {@link useLoginRedirect} hook.
 */
type UseLoginRedirectResult = {
  /**
   * Redirects the user to the login page.
   *
   * @param returnUrl - Optional specific return URL. If not provided, uses the current URL.
   */
  redirectToLogin: (returnUrl?: string) => void
  /**
   * Generates the login URL with the return URL query parameter.
   *
   * @param returnUrl - Optional specific return URL. If not provided, uses the current URL.
   *
   * @returns The full path to the login page with the return URL.
   */
  getLoginUrl: (returnUrl?: string) => string
}

/**
 * Hook to handle redirection to the login page with a return URL.
 */
export function useLoginRedirect(): UseLoginRedirectResult {
  // We need to use the router to do the redirect
  const router = useRouter()

  // We need the current URL to redirect pass to the login page as the return URL
  const getCurrentUrl = useCurrentUrl()

  /**
   * Generates the login URL with the return URL query parameter.
   *
   * @param returnUrl - Optional specific return URL. If not provided, uses the current URL.
   * @returns The full path to the login page with the return URL.
   */
  const getLoginUrl = useCallback(
    (returnUrl?: string) => {
      return `${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(returnUrl ?? getCurrentUrl())}`
    },
    [getCurrentUrl]
  )

  /**
   * Redirects the user to the login page.
   *
   * @param returnUrl - Optional specific return URL. If not provided, uses the current URL.
   */
  const redirectToLogin = useCallback(
    (returnUrl?: string) => {
      router.push(getLoginUrl(returnUrl))
    },
    [router, getLoginUrl]
  )

  // Return the redirect function and the URL generator
  return {
    redirectToLogin,
    getLoginUrl,
  }
}
