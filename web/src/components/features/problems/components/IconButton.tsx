type IconButtonProps = {
  Icon: React.ElementType
  title: string
  onClick?: () => void
}

export const IconButton = ({ Icon, title, onClick }: IconButtonProps) => (
  <button
    title={title}
    className="p-2 text-gray-400 transition-colors rounded-md hover:text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    onClick={(e) => {
      e.stopPropagation()
      onClick?.()
    }}
  >
    <Icon size={18} />
  </button>
)
