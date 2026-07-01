import { Button } from '@/components/shared/components/Button'

/**
 * Props for the {@link IconButton} component.
 */
type IconButtonProps = {
  /** The icon to render. */
  Icon: React.ElementType
  /** Accessible label / tooltip. */
  title: string
  /** Click handler; the surrounding card's click is suppressed. */
  onClick?: () => void
}

/**
 * A compact ghost icon button for problem-card actions.
 */
export const IconButton = ({ Icon, title, onClick }: IconButtonProps) => (
  <Button
    variant="ghost"
    size="icon"
    title={title}
    onClick={(event) => {
      // Don't let the click bubble to the card behind it
      event.stopPropagation()

      // Run the action
      onClick?.()
    }}
  >
    <Icon size={18} />
  </Button>
)
