type IconButtonProps = {
  Icon: React.ElementType
  title: string
  onClick?: () => void
}

export const IconButton = ({ Icon, title, onClick }: IconButtonProps) => (
  <button
    title={title}
    className="p-2 text-muted transition-colors rounded-md hover:text-foreground hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    onClick={(e) => {
      e.stopPropagation()
      onClick?.()
    }}
  >
    <Icon size={18} />
  </button>
)
