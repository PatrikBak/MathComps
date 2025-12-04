'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { useSessionStorage } from '@mantine/hooks'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { AUTH_RETURN_URL_STORAGE_KEY } from '@/constants/local-storage-constants'
import { ROUTES } from '@/constants/routes'

/**
 * SSO Callback page that handles OAuth redirects.
 * This page is shown after a user authenticates with an OAuth provider (Google, Facebook, etc.)
 * and is responsible for completing the authentication flow and redirecting the user.
 */
export default function SSOCallbackPage() {
  // Get the return where the user was before the SSO callback
  const [returnUrl] = useSessionStorage<string | null>({
    key: AUTH_RETURN_URL_STORAGE_KEY,
    defaultValue: null,
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      {/* Prebuilt component handling redirect flow */}
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl={returnUrl || ROUTES.PROFILE}
        signUpForceRedirectUrl={returnUrl || ROUTES.PROFILE}
      />

      {/* Lovely captcha will show here if Cloudflare decides */}
      <div id="clerk-captcha" />

      {/* Loading indicator */}
      <div className="mt-8">
        <LoadingSpinner />
      </div>

      {/* Status message */}
      <p className="mt-4 text-slate-400 text-center">Presmerovávam...</p>
    </div>
  )
}
