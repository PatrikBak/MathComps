import type { LinkProps } from 'next/link'
import { useCallback } from 'react'

import type { RouteHref } from '@/components/shared/components/AppLink'
import { RETURN_URL_PARAM } from '@/constants/auth-constants'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

/**
 * A link to the login page that comes back to the page it sits on.
 */
type LoginLink = {
  /**
   * The login page, coming back to this page without its fragment. A link opened in a new tab gets
   * only this.
   */
  href: RouteHref
  /** Takes a click on the link over, so the way back carries the page's fragment at the click. */
  onNavigate: NonNullable<LinkProps['onNavigate']>
}

/**
 * Result of the {@link useLoginRedirect} hook.
 */
type UseLoginRedirectResult = {
  /**
   * Redirects the user to the login page.
   *
   * @param returnUrl - The page to come back to, by default this one with its fragment.
   */
  redirectToLogin: (returnUrl?: string) => void
  /** A link to the login page coming back to this page. */
  loginLink: LoginLink
}

/**
 * Names the login page that sends the user to a given page once signed in.
 *
 * @param returnUrl - The page to come back to.
 *
 * @returns The login route, carrying the return URL.
 */
function loginHrefFor(returnUrl: string): RouteHref {
  // The login page, carrying the way back as a parameter
  return { pathname: ROUTES.LOGIN, query: { [RETURN_URL_PARAM]: returnUrl } }
}

/**
 * Hook to handle redirection to the login page with a return URL.
 */
export function useLoginRedirect(): UseLoginRedirectResult {
  // We need to use the router to do the redirect
  const router = useRouter()

  // The page's address as rendered, and a function reading it with its fragment
  const { pathWithQuery, getCurrentUrl } = useCurrentUrl()

  // A function which sends the reader to the login page
  const redirectToLogin = useCallback(
    (returnUrl?: string) => {
      // Off to the login page, with the given way back or this page as it stands now
      router.push(loginHrefFor(returnUrl ?? getCurrentUrl()))
    },
    [router, getCurrentUrl]
  )

  // A function which takes a click on a login link over, reading the fragment at that moment
  const onLoginLinkNavigate: LoginLink['onNavigate'] = useCallback(
    (event) => {
      // The link's own navigation cancelled, since its address has no fragment
      event.preventDefault()

      // The login page, coming back to the page as it stands now
      redirectToLogin()
    },
    [redirectToLogin]
  )

  // The link to the login page, whose click reads the way back afresh
  const loginLink: LoginLink = {
    href: loginHrefFor(pathWithQuery),
    onNavigate: onLoginLinkNavigate,
  }

  // Return the redirect function and the link
  return { redirectToLogin, loginLink }
}
