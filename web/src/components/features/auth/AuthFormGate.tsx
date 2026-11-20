'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useEffect } from 'react'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { RETURN_URL_PARAM } from '@/constants/auth-constants'
import { type Locale, ROUTES } from '@/i18n/i18n'
import { getPathname } from '@/i18n/navigation'

import AuthForm from './AuthForm'

/**
 * The sign-in page's content. A signed-out visitor gets the auth form. A signed-in one gets a spinner
 * while they are sent on to the return URL.
 *
 * The form sits below the signed-in branch, so a sign-in unmounts it and everything typed into it.
 * Next keeps a page it navigates away from alive, state included. A form that stayed mounted would
 * show the email and password again on the next visit to the sign-in page, after a sign-out too.
 */
export default function AuthFormGate() {
  // Next.js router for navigation
  const router = useRouter()
  // The active locale
  const locale = useLocale() as Locale
  // Search params to get return URL from query string
  const searchParams = useSearchParams()
  // Clerk hook to get current user data
  const { user, isLoaded: isUserLoaded } = useUser()

  // The page to land on once signed in: the address's return URL, already locale-prefixed, or the
  // profile page, which needs the locale added
  const returnUrl =
    searchParams.get(RETURN_URL_PARAM) || getPathname({ href: ROUTES.PROFILE, locale })

  // Redirect logged-in users to the return URL
  useEffect(() => {
    if (isUserLoaded && user) {
      // A locale-prefixed path, so the plain router takes it as it is
      router.push(returnUrl)
    }
  }, [isUserLoaded, user, router, returnUrl])

  // A signed-in user waits on a spinner while being sent on
  if (user) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  // A signed-out visitor gets the form
  return <AuthForm returnUrl={returnUrl} />
}
