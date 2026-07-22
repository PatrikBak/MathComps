'use client'

import { useAuth } from '@clerk/nextjs'
import { ChevronDown, Heart, List, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from '@/components/shared/components/Popover'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import { useUserLists } from '../hooks/use-user-lists'
import { getProblemsPageUrl } from '../services/problem-routes'
import type { SearchFiltersState } from '../types/problem-library-types'
import type { UserListDto } from '../types/user-list-types'
import { serializeFilters } from '../utils/search-url-serialization'
import { ManageListsModal, type ManageListsModalRef } from './ManageListsModal'
import { UserListMenuItems } from './UserListMenuItems'

/**
 * Props for {@link ListsDropdown}
 */
type ListsDropdownProps = {
  /** Current filter state */
  filters: SearchFiltersState
  /** Callback to update filters with the type of change */
  onFiltersChange: (filters: SearchFiltersState, filterType: 'text' | 'discrete') => void
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName?: string | null
}

/**
 * Dropdown for switching between All Problems, Liked, and custom user lists.
 * Replaces the previous two-button mode toggle (All / Favorites).
 *
 * - Logged out: shows trigger button with login prompt on Liked/list items
 * - Logged in: fetches user lists and shows all options with counts
 * - Selection sets the appropriate URL param (favoritesOnly or listContentId)
 */
export function ListsDropdown({ filters, onFiltersChange, sharedListName }: ListsDropdownProps) {
  // Translations
  const t = useTranslations('problems.filters')

  // Auth state
  const { isLoaded, isSignedIn } = useAuth()

  // Login prompt
  const showLoginPrompt = useLoginPromptToast()

  // Dropdown open state
  const [open, setOpen] = useState(false)

  // Whether UserListMenuItems is in creation mode
  const [isCreating, setIsCreating] = useState(false)

  // Fetch user lists (only when signed in)
  const { lists, likedCount, isLoading: isListsLoading } = useUserLists()

  // Ref for the manage lists modal
  const manageRef = useRef<ManageListsModalRef>(null)

  // Open manage modal (close dropdown first)
  const handleManage = () => {
    setOpen(false)
    manageRef.current?.open()
  }

  // Determine the current trigger label and icon (skip label resolution while loading)
  const currentLabel = isListsLoading
    ? ''
    : getCurrentLabel(filters, lists ?? [], sharedListName, t)

  // Choose icon based on filter state: heart for liked, shared icon for non-owned lists, list icon otherwise
  const isSharedList =
    !!filters.listContentId && !lists?.some((list) => list.contentId === filters.listContentId)
  const CurrentIcon = filters.favoritesOnly ? Heart : isSharedList ? Share2 : List

  // Select "All Problems" — clear both favoritesOnly and listContentId
  const handleSelectAll = () => {
    onFiltersChange({ ...filters, favoritesOnly: false, listContentId: null }, 'discrete')
    setOpen(false)
  }

  // Select "Liked" — set favoritesOnly, clear listContentId
  const handleSelectLiked = () => {
    // Ensure auth state is loaded
    if (!isLoaded) return

    // Not signed in: show login prompt with redirect
    if (!isSignedIn) {
      const nextFilters = { ...filters, favoritesOnly: true, listContentId: null }
      const queryString = serializeFilters(nextFilters)
      const redirectUrl = getProblemsPageUrl(queryString)
      showLoginPrompt({ reason: t('viewFavoritesAuthReason'), redirectUrl })
      setOpen(false)
      return
    }

    // Signed in: apply filter
    onFiltersChange({ ...filters, favoritesOnly: true, listContentId: null }, 'discrete')
    setOpen(false)
  }

  // Select a custom list — set listContentId, clear favoritesOnly
  const handleSelectList = (contentId: string) => {
    onFiltersChange({ ...filters, favoritesOnly: false, listContentId: contentId }, 'discrete')
    setOpen(false)
  }

  // Whether this is the "all" view (no list filter active)
  const isAllActive = !filters.favoritesOnly && !filters.listContentId

  // Whether the trigger should show a loading state
  // (signed in, lists loading, and a filter is active that needs list data to resolve its label)
  const isTriggerLoading = isListsLoading && (filters.favoritesOnly || !!filters.listContentId)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        {/* Trigger button */}
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200',
              'border-foreground/10 bg-surface/60 text-foreground',
              'hover:bg-foreground/5 hover:border-muted/50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isTriggerLoading ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <>
                  <CurrentIcon className="h-4 w-4 shrink-0 text-muted" />
                  <span className="truncate">{currentLabel}</span>
                </>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted transition-transform duration-200',
                open && 'rotate-180'
              )}
            />
          </button>
        </PopoverTrigger>

        {/* Popover content */}
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)]"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {/* All Problems */}
          <PopoverItem
            disabled={isCreating}
            onClick={handleSelectAll}
            className={cn(isAllActive && 'text-focus/80')}
          >
            <div className="flex w-full items-center gap-2">
              <List className={cn('h-4 w-4', isAllActive ? 'text-focus' : 'text-muted')} />
              <span>{t('allProblems')}</span>
            </div>
          </PopoverItem>

          {/* Liked */}
          <PopoverItem
            disabled={isCreating}
            onClick={handleSelectLiked}
            className={cn(filters.favoritesOnly && 'text-focus/80')}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-muted" />
                <span>{t('myFavorites')}</span>
              </div>
              {isSignedIn && likedCount !== undefined && (
                <span className="text-xs text-muted">{likedCount}</span>
              )}
            </div>
          </PopoverItem>

          {/* Custom lists + new list creation (shared component) */}
          <UserListMenuItems
            mode="filter"
            activeContentId={filters.listContentId}
            onSelectList={handleSelectList}
            onClose={() => setOpen(false)}
            onManage={handleManage}
            onCreatingChange={setIsCreating}
          />
        </PopoverContent>
      </Popover>

      {/* Manage Lists Modal */}
      <ManageListsModal ref={manageRef} onSelectList={handleSelectList} />
    </>
  )
}

/**
 * Determines the trigger label based on current filter state.
 *
 * @param filters - The current filter state
 * @param lists - The user's lists
 * @param t - The translation function
 * @returns The trigger label
 */
function getCurrentLabel(
  filters: SearchFiltersState,
  lists: UserListDto[],
  sharedListName: string | null | undefined,
  t: ReturnType<typeof useTranslations<'problems.filters'>>
): string {
  // Favorite problem have a translation key
  if (filters.favoritesOnly) return t('myFavorites')

  // Custom lists have user-defined names
  if (filters.listContentId) {
    // Find the list with the matching contentId
    const list = lists.find((list) => list.contentId === filters.listContentId)

    // List found in user's own lists — return its name
    if (list) return list.name

    // Shared list from another user — use the name from the API response if available
    if (sharedListName) return sharedListName

    // Fallback to generic label while data is loading
    return t('sharedListLabel')
  }

  // If no custom list is selected, return "All Problems"
  return t('allProblems')
}
