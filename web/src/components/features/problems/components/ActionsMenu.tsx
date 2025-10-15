import { Eye, EyeOff, HelpCircle, MoreVertical, Share2 } from 'lucide-react'
import React, { useRef } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../shared/components/DropdownMenu'
import Tooltip from '../../../shared/components/Tooltip'
import type { SearchFiltersState } from '../types/problem-library-types'
import { ShareButton } from './ShareButton'

/**
 * Props for the ActionsMenu component.
 * Manages the dropdown menu containing global actions and settings
 * for the problem library interface.
 */
type ActionsMenuProps = {
  /** Whether technique tags are currently visible on problem cards */
  showTechniqueTags: boolean
  /** Callback to toggle technique tag visibility; invoked when user clicks the eye icon */
  onShowTagsChange: (show: boolean) => void
  /** Current filter state; passed to ShareButton for generating shareable URLs */
  filters: SearchFiltersState
}

/**
 * Dropdown menu containing additional actions for the active filters bar.
 * Includes:
 * - Share button (visible on small screens only)
 * - Technique tag visibility toggle (always visible)
 */
export function ActionsMenu({ showTechniqueTags, onShowTagsChange, filters }: ActionsMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        // Clear focus from trigger when dropdown closes to prevent persistent highlight
        if (!isOpen) {
          setTimeout(() => {
            if (buttonRef.current && document.activeElement === buttonRef.current) {
              buttonRef.current.blur()
            }
          }, 100)
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={buttonRef}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md
               text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
               transition-colors duration-150"
          aria-label="Ďalšie akcie"
          onMouseDown={(e) => {
            // Prevent focus on mouse down to avoid focus ring
            e.preventDefault()
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 share-custom-hide-content">
        {/* Share Button - only visible on small screens (below custom breakpoint) */}
        <ShareButton filters={filters} asChild>
          <DropdownMenuItem className="cursor-pointer">
            <div className="flex items-center">
              <span className="mr-2 flex w-5 items-center justify-center">
                <Share2 className="h-4 w-4" />
              </span>
              <span>Zdieľať filtre</span>
            </div>
          </DropdownMenuItem>
        </ShareButton>

        {/* Separator between Share and Technique toggle */}
        <DropdownMenuSeparator />

        {/* Technique Toggle - always visible as a global setting */}
        <DropdownMenuItem
          onSelect={(e) => {
            // Prevent menu from closing on selection
            e.preventDefault()
            onShowTagsChange(!showTechniqueTags)
          }}
          className="cursor-pointer"
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              {/* Fixed-width container for alignment */}
              <span className="mr-2 flex w-5 items-center justify-center">
                {showTechniqueTags ? (
                  <Eye className="h-4 w-4 text-indigo-400" />
                ) : (
                  <EyeOff className="h-4 w-4 text-slate-500" />
                )}
              </span>
              <span className={showTechniqueTags ? 'text-indigo-100' : ''}>
                {showTechniqueTags ? 'Skryť techniky' : 'Zobraziť techniky'}
              </span>
            </div>
            <Tooltip content="Ovláda viditeľnosť tagov označujúcich techniky riešenia (napr. substitúcia, rozklad, úprava výrazu). Tieto tagy pomáhajú identifikovať matematické metódy použité v úlohách.">
              <div
                className="p-1"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                <HelpCircle className="h-4 w-4 cursor-help text-slate-500 hover:text-slate-400" />
              </div>
            </Tooltip>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
