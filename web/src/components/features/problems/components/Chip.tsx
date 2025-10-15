import { cn } from '../../../shared/utils/css-utils'

// Chip Component for individual filter items
export default function Chip({
  children,
  onRemove,
  onClick,
  clickable = false,
  isSelected = false,
  title,
  className,
}: {
  children: React.ReactNode
  onRemove?: () => void
  onClick?: () => void
  clickable?: boolean
  isSelected?: boolean
  title?: string
  className?: string
}) {
  // Determine styling based on selected state and clickable state
  const getChipStyling = () => {
    const baseStyles =
      'inline-flex max-w-full items-center gap-1.5 rounded-full py-1 text-[12px] font-medium transition-colors'
    const paddingStyles = onRemove ? 'pl-2 pr-1' : 'px-2'

    if (isSelected) {
      // Selected state: bright indigo background with white text
      const selectedStyles = 'border-indigo-400 bg-indigo-500/80 text-white'
      const hoverStyles = clickable ? 'hover:bg-indigo-400/90 hover:border-indigo-300' : ''
      return `${baseStyles} ${paddingStyles} ${selectedStyles} ${hoverStyles}`
    } else {
      // Default state: subtle indigo background
      const defaultStyles = 'border-slate-600/60 bg-indigo-600/20 text-indigo-100'
      const hoverStyles = clickable ? 'hover:bg-indigo-500/30 hover:border-indigo-400/60' : ''
      return `${baseStyles} ${paddingStyles} ${defaultStyles} ${hoverStyles}`
    }
  }

  return (
    <span
      className={cn(getChipStyling(), className)}
      onClick={clickable ? onClick : undefined}
      data-clickable={clickable ? 'true' : undefined}
      title={title || (typeof children === 'string' ? children : undefined)}
    >
      {/* Display full tag text without truncation, but keep it on one line */}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-200 transition-colors hover:bg-indigo-500/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label={`Odstrániť filter: ${typeof children === 'string' ? children : ''}`}
        >
          &times;
        </button>
      )}
    </span>
  )
}
