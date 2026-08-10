import { Eye, EyeOff, MoreVertical, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../shared/components/DropdownMenu'
import { HelpTooltip } from '../../../shared/components/HelpTooltip'
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
  // Get translations
  const tProblems = useTranslations('problems')
  const tActions = useTranslations('ui.actions')

  // Dropdown state
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md
               text-muted hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
               transition-colors duration-150"
          aria-label={tProblems('moreActions')}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 share-custom-hide-content"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {/* Share Button - only visible on small screens (below custom breakpoint) */}
        <ShareButton filters={filters}>
          <DropdownMenuItem>
            <div className="flex items-center">
              <span className="mr-2 flex w-5 items-center justify-center">
                <Share2 className="h-4 w-4" />
              </span>
              <span>{tActions('share')}</span>
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
                  <Eye className="h-4 w-4 text-focus" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted" />
                )}
              </span>
              <span className={showTechniqueTags ? 'text-focus/80' : ''}>
                {showTechniqueTags ? tProblems('hideTechniques') : tProblems('showTechniques')}
              </span>
            </div>
            <HelpTooltip
              label={tProblems('techniquesHelpLabel')}
              content={tProblems('techniquesHelpTooltip')}
            />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
