import MathCompsLogo from '@/components/layout/MathCompsLogo'

import type { AuthScreen } from './AuthForm'

/**
 * Props for the {@link AuthFormHeader} component.
 */
type AuthFormHeaderProps = {
  /** Current authentication screen determining the subtitle text */
  screen: AuthScreen
}

/**
 * Header component for the authentication form.
 */
export default function AuthFormHeader({ screen }: AuthFormHeaderProps) {
  return (
    <div className="text-center mb-8">
      <div className="flex justify-center mb-5">
        <MathCompsLogo />
      </div>
      <h5 className="text-lg font-semibold text-slate-400 tracking-wider uppercase mb-2">
        {(() => {
          switch (screen) {
            case 'hub':
            case 'enter-email':
              return 'PRIHLÁSENIE / REGISTRÁCIA'
            case 'login-with-email':
              return 'PRIHLÁSTE SA'
            case 'signup-with-email':
              return 'VYTVORTE SI ÚČET'
            case 'forgotten-password':
              return 'OBNOVENIE HESLA'
            case 'password-reset-code':
              return 'ZADANIE KÓDU'
            case 'enter-new-password':
              return 'NOVÉ HESLO'
            case 'email-verification':
              return 'OVERENIE EMAILU'
          }
        })()}
      </h5>
    </div>
  )
}
