import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link AuthButton} component. Extends standard button attributes.
 */
type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The content of the button */
  children: ReactNode
  /** Visual variant of the button */
  variant: 'social' | 'primary'
}

/**
 * Reusable button component for authentication forms.
 */
export default function AuthButton({ className, children, variant, ...props }: AuthButtonProps) {
  // Each variant has a different border and background
  const variantStyles = {
    social:
      'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-lg hover:shadow-black/20',
    primary:
      'bg-linear-to-r from-indigo-500/30 to-indigo-600/30 border border-indigo-500/50 text-white hover:from-indigo-500/40 hover:to-indigo-600/40 hover:border-indigo-400/70 hover:shadow-lg hover:shadow-indigo-500/20',
  }

  return (
    <button
      type={'button'}
      className={cn(
        'w-full py-3 px-6 text-sm font-medium rounded-lg',
        'flex items-center justify-center gap-3',
        'transition-all duration-200',
        'active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
