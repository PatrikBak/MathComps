import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'

import type { AuthScreen } from './AuthForm'

/**
 * Props for the {@link AuthFormActions} component.
 */
type AuthFormActionsProps = {
  /** Current authentication screen */
  screen: Omit<AuthScreen, 'hub'>
  /** Whether the form is currently submitting */
  loading: boolean
  /** Callback to switch between authentication screens */
  onScreenSwitch: (newScreen: AuthScreen) => void
  /** Callback for the back button */
  onBack: () => void
}

/**
 * The component containing action buttons for the authentication form.
 * Used only when we are continuing from the hub screen (email entry).
 */
export default function AuthFormActions({
  screen,
  loading,
  onScreenSwitch,
  onBack,
}: AuthFormActionsProps) {
  // Get the translation
  const t = useTranslations('auth')

  return (
    <>
      {/* Forgot Password Link */}
      {screen === 'login-with-email' && (
        <div className="flex justify-end mt-2">
          <Button
            variant="link"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onScreenSwitch('forgotten-password')
            }}
          >
            {t('forgotPassword')}
          </Button>
        </div>
      )}

      {/* Submit Button */}
      <Button variant="primary" fullWidth type="submit" disabled={loading} className="mt-8">
        {(() => {
          switch (screen) {
            case 'login-with-email':
              return t('login')
            case 'signup-with-email':
              return t('register')
            case 'forgotten-password':
              return t('sendCode')
            case 'password-reset-code':
              return t('verifyCode')
            case 'enter-new-password':
              return t('resetPassword')
            case 'email-verification':
              return t('verifyEmail')
            case 'enter-email':
              return t('continue')
          }
        })()}
      </Button>

      {/* Back Button */}
      <Button
        variant="secondary"
        fullWidth
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onBack()
        }}
        disabled={loading}
        className="mt-3"
      >
        {t('back')}
      </Button>
    </>
  )
}
