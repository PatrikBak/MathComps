import { useRouter } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'
import { useCurrentUrl } from '@/hooks/use-current-url'

/**
 * Parameters for the options object passed to the show function
 */
type UseLoginPromptToastParams = {
  /* Message to display in the toast, in the format "Pre [reason] sa musíte prihlásiť" */
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
  // Function to get the current URL, needed for the login prompt toast
  const getCurrentUrl = useCurrentUrl()

  // Ref to track if the login link was clicked
  // We don't want to trigger the onDismiss callback
  // if the user is actually proceeding to login
  const isLoginClickedRef = useRef(false)

  // Router to navigate to the login page
  const router = useRouter()

  // Return the function to show the toast
  return useCallback(
    ({ reason, onDismiss, redirectUrl }: UseLoginPromptToastParams) => {
      // Reset the ref for the new toast
      isLoginClickedRef.current = false

      // Show the toast
      toast.warning(`Pre ${reason} sa musíte prihlásiť`, {
        action: {
          label: 'Prihlásiť sa',
          onClick: () => {
            // Remember that the login link was clicked
            isLoginClickedRef.current = true

            // Determine the return URL
            const returnUrl = redirectUrl ?? getCurrentUrl()

            // Navigate to the login page
            router.push(`${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(returnUrl)}`)
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
    [getCurrentUrl, router]
  )
}
