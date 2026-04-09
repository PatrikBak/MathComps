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
      'bg-foreground/5 border border-foreground/10 text-foreground hover:bg-foreground/10 hover:border-muted/60',
    primary:
      'bg-brand/40 border border-foreground/10 text-brand-foreground hover:bg-brand/60 hover:border-muted/60 hover:shadow-lg',
    secondary:
      'bg-surface/40 border border-foreground/10 text-muted hover:bg-surface/60 hover:border-muted/60 hover:text-muted-foreground',
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
