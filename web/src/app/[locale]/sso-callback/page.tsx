'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { useSessionStorage, useTimeout } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { SECOND_MS } from '@/components/shared/utils/time-units'
import { AUTH_RETURN_URL_STORAGE_KEY } from '@/constants/local-storage-constants'
import { ROUTES } from '@/i18n/i18n'

/**
 * How long the handover is given before the page says it did not finish. A healthy return navigates away
 * within a second or two.
 */
const HANDOVER_TIMEOUT_MS = 20 * SECOND_MS

/**
 * SSO Callback page that handles OAuth redirects.
 * This page is shown after a user authenticates with an OAuth provider (Google, etc.)
 * and is responsible for completing the authentication flow and redirecting the user.
 */
export default function SSOCallbackPage() {
  // Get the translations
  const t = useTranslations('common')

  // Get the return where the user was before the SSO callback
  const [returnUrl] = useSessionStorage<string | null>({
    key: AUTH_RETURN_URL_STORAGE_KEY,
    defaultValue: null,
  })

  // Whether the handover has run past its timeout without finishing
  const [isStalled, setIsStalled] = useState(false)

  // The clock that marks the handover stalled, started when the page appears
  useTimeout(() => setIsStalled(true), HANDOVER_TIMEOUT_MS, { autoInvoke: true })

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
      {!isStalled && (
        <>
          <div className="mt-8">
            <LoadingSpinner />
          </div>

          {/* Status message */}
          <p className="mt-4 text-muted text-center">{t('redirecting')}</p>
        </>
      )}

      {/* Stalled message */}
      {isStalled && (
        <div className="mt-8 text-center">
          <p className="text-muted">{t('signInStalled')}</p>
          <AppLink href={ROUTES.LOGIN} className="mt-2 inline-block">
            {t('signInAgain')}
          </AppLink>
        </div>
      )}
    </div>
  )
}
