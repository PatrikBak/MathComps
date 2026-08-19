import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ButtonHTMLAttributes, Ref } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * The shared keyboard-focus ring: a 2px ring in the focus color, offset from the element.
 */
export const FOCUS_RING_CLASS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * The focus ring for a control sitting inside a scroll container, drawn within the control's own box.
 *
 * A container that scrolls on either axis clips on both, so {@link FOCUS_RING_CLASS} loses its top and
 * bottom edges to the clip and comes out as two disconnected stubs.
 */
export const FOCUS_RING_INSET_CLASS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'

/**
 * The focus ring a row draws on behalf of the control inside it.
 *
 * A 16px checkbox's own outline is a hard thing to follow down a list of forty, so the row it sits in
 * carries the mark instead and the control gives its own up. Keyed on the row's input alone: a row
 * holding a second control of its own leaves that one to ring itself rather than reading as a box
 * inside a box. A row that takes focus itself reaches for {@link FOCUS_RING_INSET_CLASS} instead.
 */
export const FOCUS_RING_ROW_CLASS = cn(
  'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-focus',
  '[&_input:focus-visible]:outline-none'
)

/**
 * The app's button styles.
 *
 * `primary` fills with the brand (violet); the focus ring stays on `focus` (indigo). `outline` is
 * `subtle` with the fill moved to hover, for a surface that already carries a tint.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium hyphens-none',
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
        outline:
          'border border-foreground/10 text-foreground hover:bg-foreground/5 hover:border-muted/60',
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
    /** Handle onto the underlying button. */
    ref?: Ref<HTMLButtonElement>
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
  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  return (
    <button
      type={type}
      disabled={disabled || loading}
      // Paired with the live region below, which is what actually speaks the state
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant, size, shape, fullWidth }),
        className,
        // The spinner below is positioned against the button, so this must beat the caller's class
        loading && 'relative'
      )}
      {...rest}
    >
      {/* The spinner overlays the label, which stays in place holding the width it had. It goes
          transparent rather than hidden, which would take the button's name out of the a11y tree */}
      {loading ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          </span>

          {/* What the spinner says, for readers it says nothing to. A button disabled the moment it
              is pressed drops out of the tab order, taking any word of its own state with it */}
          <span role="status" className="sr-only">
            {tActions('busy')}
          </span>

          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
