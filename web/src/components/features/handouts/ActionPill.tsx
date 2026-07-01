'use client'

import { buttonVariants } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Visual fields shared by both variants of {@link ActionPill}.
 */
type ActionPillBaseProps = {
  /** Leading icon node. */
  icon: React.ReactNode
  /** Action label. */
  label: string
}

/**
 * Link variant of the {@link ActionPillProps} discriminated union.
 */
type ActionPillLinkProps = ActionPillBaseProps & {
  /** Discriminator */
  kind: 'link'
  /** External target URL. */
  href: string
}

/**
 * Button variant of the {@link ActionPillProps} discriminated union.
 */
type ActionPillButtonProps = ActionPillBaseProps & {
  /** Discriminator */
  kind: 'button'
  /** Click handler. */
  onClick: () => void
}

/**
 * Props for the {@link ActionPill} component.
 */
type ActionPillProps = ActionPillLinkProps | ActionPillButtonProps

/**
 * Neutral pill chip that renders a single action — either as a link or as a button.
 */
export function ActionPill(props: ActionPillProps) {
  // Shared pill styling off the Button primitive's subtle look; px-4 overrides sm's px-3
  const className = cn(buttonVariants({ variant: 'subtle', shape: 'pill', size: 'sm' }), 'px-4')

  // Icon plus uppercase muted label
  const content = (
    <>
      {props.icon}
      <span className="text-sm uppercase font-semibold text-muted-foreground">{props.label}</span>
    </>
  )

  // Dispatch on the variant
  switch (props.kind) {
    case 'link':
      return (
        <a href={props.href} target="_blank" rel="noopener noreferrer" className={className}>
          {content}
        </a>
      )
    case 'button':
      return (
        <button type="button" onClick={props.onClick} className={className}>
          {content}
        </button>
      )
  }
}
