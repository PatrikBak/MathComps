import React from 'react'

import { preventFocusLoss } from '../utils/keyboard-utils'

/**
 * Props for the {@link ToolbarButton} component.
 */
type ToolbarButtonProps = {
  /** Callback when the button is clicked */
  onClick: () => void
  /** Icon component to display (e.g., Bold, Italic from lucide-react) */
  icon?: React.ComponentType<{ size?: number }>
  /** Text content to display instead of an icon (e.g., "$", "$$") */
  text?: string
  /** Tooltip text shown on hover */
  title: string
}

/**
 * Toolbar button component. Supports either an icon component OR text content
 */
export function ToolbarButton({ onClick, icon: Icon, text, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={preventFocusLoss}
      title={title}
      className="flex items-center justify-center gap-1.5 px-2 py-1 rounded transition-colors text-xs min-w-[28px] text-muted hover:text-foreground hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {Icon && <Icon size={14} />}
      {text && <span className="font-mono font-semibold text-sm">{text}</span>}
    </button>
  )
}
