import { useTranslations } from 'next-intl'

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
  // Get the translation
  const t = useTranslations('auth.headers')

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
              return t('loginOrRegister')
            case 'login-with-email':
              return t('login')
            case 'signup-with-email':
              return t('createAccount')
            case 'forgotten-password':
              return t('passwordReset')
            case 'password-reset-code':
              return t('enterCode')
            case 'enter-new-password':
              return t('newPassword')
            case 'email-verification':
              return t('verifyEmail')
          }
        })()}
      </h5>
    </div>
  )
}
