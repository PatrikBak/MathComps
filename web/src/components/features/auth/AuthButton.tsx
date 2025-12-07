import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link AuthButton} component. Extends standard button attributes.
 */
type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The content of the button */
  children: ReactNode
  /** Visual variant of the button */
  variant: 'social' | 'primary' | 'secondary'
}

/**
 * Reusable button component for authentication forms.
 */
export default function AuthButton({ className, children, variant, ...props }: AuthButtonProps) {
  // Each variant has a different border and background
  const variantStyles = {
    social:
      'bg-white/5 border border-slate-600/40 text-slate-200 hover:bg-white/10 hover:border-slate-500/60',
    primary:
      'bg-indigo-400/40 border border-slate-600/40 text-white hover:bg-indigo-400/60 hover:border-slate-500/60 hover:shadow-lg',
    secondary:
      'bg-slate-800/40 border border-slate-600/40 text-slate-400 hover:bg-slate-800/60 hover:border-slate-500/60 hover:text-slate-300',
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
