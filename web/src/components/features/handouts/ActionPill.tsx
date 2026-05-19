'use client'

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
  // Shared pill styling
  const className =
    'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 ' +
    'border border-foreground/10 leading-5 hover:bg-foreground/10 transition-colors'

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
