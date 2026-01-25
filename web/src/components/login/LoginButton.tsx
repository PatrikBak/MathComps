'use client'

import { LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import { useLoginRedirect } from '@/hooks/use-login-redirect'

/**
 * Props for the {@link LoginButton} component.
 */
type LoginButtonProps = {
  /** Optional additional classes */
  className?: string
  /** Optional callback before redirect */
  onBeforeRedirect?: () => void
}

/**
 * A subtle login button with a text link style and rounded outline.
 * Used in places where a less prominent login CTA is appropriate.
 */
export function LoginButton({ className, onBeforeRedirect }: LoginButtonProps) {
  // Get translations
  const t = useTranslations('auth')

  // This function redirects to the login page with a correct returnUrl
  const { redirectToLogin } = useLoginRedirect()

  return (
    <button
      onClick={() => {
        onBeforeRedirect?.()
        redirectToLogin()
      }}
      className={cn(
        'flex items-center gap-2 text-violet-300 hover:text-violet-200',
        'py-2 px-4 rounded-full',
        'outline outline-slate-600 hover:outline-white/50',
        'transition-all text-sm',
        className
      )}
    >
      <LogIn className="w-4 h-4" />
      {t('login')}
    </button>
  )
}
