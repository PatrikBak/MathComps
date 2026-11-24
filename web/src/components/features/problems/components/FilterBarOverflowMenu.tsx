import { Eye, EyeOff, MoreVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, type ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * An action of the bar, as the overflow menu lists it once the bar has no room for it.
 */
export type OverflowAction = {
  /** Identifies the action among the bar's. */
  key: string
  /** The action's rows. */
  rows: ReactNode
}

/**
 * The props of {@link FilterBarOverflowMenu}.
 */
type FilterBarOverflowMenuProps = {
  /** The actions the bar has no room for, in the bar's own order. */
  overflowActions: OverflowAction[]
  /** Whether technique tags show on every card. */
  showTechniqueTags: boolean
  /** Shows technique tags on every card, or hides them. */
  onShowTechniqueTagsChange: (show: boolean) => void
}

/**
 * The overflow menu of the bar over the list: the actions the bar has no room for, each set apart from the next, and
 * showing or hiding technique tags.
 */
export function FilterBarOverflowMenu({
  overflowActions,
  showTechniqueTags,
  onShowTechniqueTagsChange,
}: FilterBarOverflowMenuProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted',
            'hover:bg-foreground/5 hover:text-muted-foreground transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
          )}
          aria-label={tProblems('moreActions')}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* The actions the bar has no room for, each followed by a separator */}
        {overflowActions.map((action) => (
          <Fragment key={action.key}>
            {action.rows}
            <DropdownMenuSeparator />
          </Fragment>
        ))}

        {/* Technique tags, the menu staying open on a pick so the change shows behind it */}
        <DropdownMenuItem
          onSelect={(event) => {
            // The menu stays open
            event.preventDefault()

            // And the tags flip
            onShowTechniqueTagsChange(!showTechniqueTags)
          }}
          className="cursor-pointer"
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              {/* The eye, in the slot every row's icon sits in */}
              <DropdownMenuItemIcon>
                {showTechniqueTags ? (
                  <Eye className="h-4 w-4 text-brand-light" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted" />
                )}
              </DropdownMenuItemIcon>

              {/* What a pick does */}
              <span className={showTechniqueTags ? 'text-brand-light' : ''}>
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
