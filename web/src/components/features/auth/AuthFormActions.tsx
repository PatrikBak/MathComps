import { cn } from '@/components/shared/utils/css-utils'

import AuthButton from './AuthButton'
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
  return (
    <>
      {/* Forgot Password Link */}
      {screen === 'login-with-email' && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onScreenSwitch('forgotten-password')
            }}
            className="text-indigo-400 font-medium hover:text-indigo-300 hover:underline transition-colors cursor-pointer text-sm"
          >
            Zabudli ste heslo?
          </button>
        </div>
      )}

      {/* Submit Button */}
      <AuthButton
        type="submit"
        disabled={loading}
        className={cn(
          'bg-gradient-to-r from-indigo-400/40 to-indigo-500/40 border border-indigo-400/50 text-white hover:from-indigo-400/60 hover:to-indigo-500/60 hover:border-indigo-400/70 hover:shadow-lg',
          'mt-8'
        )}
      >
        {(() => {
          switch (screen) {
            case 'login-with-email':
              return 'Prihlásiť sa'
            case 'signup-with-email':
              return 'Registrovať sa'
            case 'forgotten-password':
              return 'Odoslať kód'
            case 'password-reset-code':
              return 'Overiť kód'
            case 'enter-new-password':
              return 'Obnoviť heslo'
            case 'email-verification':
              return 'Overiť email'
            case 'enter-email':
              return 'Pokračovať'
          }
        })()}
      </AuthButton>

      {/* Back Button */}
      <AuthButton
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onBack()
        }}
        disabled={loading}
        className={cn(
          'bg-slate-800/40 border border-slate-600/40 text-slate-400 hover:bg-slate-800/60 hover:border-slate-500/60 hover:text-slate-300',
          'mt-3'
        )}
      >
        Späť
      </AuthButton>
    </>
  )
}
