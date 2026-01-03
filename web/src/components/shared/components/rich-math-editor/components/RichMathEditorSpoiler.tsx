'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link RichMathEditorSpoiler} component.
 */
type RichMathEditorSpoilerProps = {
  /** The label to display in the header */
  label: string
  /** The content to display inside the spoiler */
  children: ReactNode
}

/**
 * Collapsible spoiler component with a clickable label header.
 * Shows the label as a clickable header. Content is hidden until clicked.
 */
export function RichMathEditorSpoiler({ label, children }: RichMathEditorSpoilerProps) {
  // State to track whether the spoiler is open or closed
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-2 rounded-lg border border-slate-600/60 bg-slate-800/30 overflow-hidden">
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left transition-colors',
          'text-gray-300 hover:text-gray-100 hover:bg-slate-700/50',
          isOpen && 'bg-slate-700/30'
        )}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown size={16} className="text-indigo-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
        )}
        <span>{label}</span>
      </button>

      {/* Border separator - always present, opacity-controlled */}
      <div
        className={cn(
          'h-px bg-slate-600/60 transition-opacity duration-150',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Collapsible content */}
      {isOpen && <div className="px-3 py-2 text-sm text-gray-300">{children}</div>}
    </div>
  )
}
