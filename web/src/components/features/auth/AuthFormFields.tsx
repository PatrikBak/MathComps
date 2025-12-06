import { AtSign, KeyRound, Lock, LockKeyhole, Mail, User } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { cn } from '@/components/shared/utils/css-utils'

import type { AuthScreen } from './AuthForm'
import { InputField } from './AuthFormInputField'
import type { AuthFormValues } from './authFormSchema'

/**
 * Props for the {@link AuthFormFields} component.
 */
type AuthFormFieldsProps = {
  /** Current authentication screen */
  screen: AuthScreen
  /** Email entered in the previous step (if any) */
  enteredEmail?: string
}

/**
 * Form fields component for email and password inputs.
 */
export default function AuthFormFields({ screen, enteredEmail }: AuthFormFieldsProps) {
  // Get form state and register function from react-hook-form context
  const {
    register,
    formState: { errors },
  } = useFormContext<AuthFormValues>()

  return (
    <div className="space-y-4">
      {/* Email Field  */}
      {(screen === 'login-with-email' ||
        screen === 'signup-with-email' ||
        screen === 'forgotten-password' ||
        screen === 'enter-email') && (
        <InputField
          id="email"
          label="Email"
          icon={AtSign}
          placeholder="Zadajte email"
          type="email"
          error={'email' in errors ? errors.email : undefined}
          registration={register('email')}
        />
      )}

      {/* Name Field */}
      {screen === 'signup-with-email' && (
        <InputField
          id="firstName"
          label="Meno alebo prezývka"
          icon={User}
          placeholder="Zadajte meno alebo prezývku"
          error={'firstName' in errors ? errors.firstName : undefined}
          registration={register('firstName')}
        />
      )}

      {/* Code Field  */}
      {(screen === 'password-reset-code' || screen === 'email-verification') && (
        <div className="space-y-6">
          {/* Code message */}
          {enteredEmail && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg',
                'bg-blue-500/10 px-3 py-2.5',
                'border border-blue-500/20'
              )}
            >
              <Mail className="mt-0.5 size-4 shrink-0 text-blue-400" />
              <p className="text-xs leading-relaxed text-slate-300">Overovací kód bol odoslaný</p>
            </div>
          )}

          {/* Code input */}
          <InputField
            id="code"
            label="Kód z emailu"
            icon={KeyRound}
            placeholder="Zadajte 6-miestny kód"
            maxLength={6}
            error={'code' in errors ? errors.code : undefined}
            registration={register('code')}
          />
        </div>
      )}

      {/* Password Field  */}
      {(screen === 'login-with-email' ||
        screen === 'signup-with-email' ||
        screen === 'enter-new-password') && (
        <InputField
          id="password"
          label={screen === 'enter-new-password' ? 'Nové heslo' : 'Heslo'}
          icon={Lock}
          placeholder={screen === 'enter-new-password' ? 'Zadajte nové heslo' : 'Zadajte heslo'}
          type="password"
          error={'password' in errors ? errors.password : undefined}
          registration={register('password')}
        />
      )}

      {/* Confirm Password Field */}
      {(screen === 'signup-with-email' || screen === 'enter-new-password') && (
        <InputField
          id="confirmPassword"
          label="Potvrdiť heslo"
          icon={LockKeyhole}
          placeholder="Zadajte heslo znova"
          type="password"
          error={'confirmPassword' in errors ? errors.confirmPassword : undefined}
          registration={register('confirmPassword')}
        />
      )}
    </div>
  )
}
