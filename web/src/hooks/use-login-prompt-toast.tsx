import { useTranslations } from 'next-intl'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { useLoginRedirect } from '@/hooks/use-login-redirect'

/**
 * Parameters for the options object passed to the show function
 */
type UseLoginPromptToastParams = {
  /* Message to display in the toast, the reason why login is required */
  reason: string
  /* Optional callback to be called when the toast is dismissed */
  onDismiss?: () => void
  /* Optional URL to redirect to after login. If not provided, the current URL is used. */
  redirectUrl?: string
}

/**
 * Shows a toast notification prompting the user to log in.
 */
export function useLoginPromptToast() {
  // Use the login redirect hook
  const { redirectToLogin } = useLoginRedirect()

  // Translations for UI strings
  const t = useTranslations('auth')

  // Ref to track if the login link was clicked
  // We don't want to trigger the onDismiss callback
  // if the user is actually proceeding to login
  const isLoginClickedRef = useRef(false)

  // Return the function to show the toast
  return useCallback(
    ({ reason, onDismiss, redirectUrl }: UseLoginPromptToastParams) => {
      // Reset the ref for the new toast
      isLoginClickedRef.current = false

      // Show the toast
      toast.warning(t('loginRequired', { reason }), {
        action: {
          label: t('login'),
          onClick: () => {
            // Remember that the login link was clicked
            isLoginClickedRef.current = true

            // Navigate to the login page
            redirectToLogin(redirectUrl)
          },
        },
        // When the toast is dismissed...
        onDismiss: () => {
          // ...and it is not because the user clicked the login link...
          if (!isLoginClickedRef.current) {
            // ...only then call the onDismiss callback
            onDismiss?.()
          }
        },
      })
    },
    [redirectToLogin, t]
  )
}
