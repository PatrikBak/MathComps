import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link AuthButton} component. Extends standard button attributes.
 */
type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The content of the button */
  children: ReactNode
}

/**
 * Reusable button component for authentication forms.
 */
export default function AuthButton({
  className,
  children,
  type = 'button',
  ...props
}: AuthButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'w-full py-3 px-6 text-sm font-medium rounded-lg backdrop-blur-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 group',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
