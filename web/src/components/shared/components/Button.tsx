import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * The shared keyboard-focus ring: a 2px ring in the focus color, offset from the element.
 */
export const FOCUS_RING_CLASS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * The app's button styles.
 *
 * `primary` fills with the brand (violet); the focus ring stays on `focus` (indigo).
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-all duration-200 active:scale-[0.98] motion-reduce:active:scale-100',
    FOCUS_RING_CLASS,
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-brand/40 border border-foreground/10 text-brand-foreground hover:bg-brand/60 hover:border-muted/60 hover:shadow-lg',
        secondary:
          'bg-surface/40 border border-foreground/10 text-muted hover:bg-surface/60 hover:border-muted/60 hover:text-muted-foreground',
        ghost: 'text-muted hover:text-foreground hover:bg-foreground/5',
        subtle:
          'bg-foreground/5 border border-foreground/10 text-foreground hover:bg-foreground/10 hover:border-muted/60',
        link: 'text-link hover:text-link-hover hover:underline',
      },
      size: {
        sm: 'min-h-9 px-3 text-sm',
        md: 'min-h-11 px-4 text-sm',
        icon: 'h-9 w-9 p-0 rounded-md',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // A link reads as inline text: drop the box sizing and press animation the other variants carry
      { variant: 'link', class: 'min-h-0 rounded px-0 active:scale-100' },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      shape: 'default',
      fullWidth: false,
    },
  }
)

/**
 * Props for the {@link Button} component.
 */
export type ButtonProps = VariantProps<typeof buttonVariants> &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Show a spinner and disable the button while an action is in flight. */
    loading?: boolean
  }

/**
 * The shared button. Every interactive `<button>` in the app should be one of these so focus
 * rings, tap targets, and the disabled/loading states stay consistent.
 */
export function Button({
  variant,
  size,
  shape,
  fullWidth,
  loading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, shape, fullWidth }), className)}
      {...rest}
    >
      {/* Spinner takes the icon slot while loading */}
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
