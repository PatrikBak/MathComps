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

import { useAuthGatedFilter } from '../hooks/use-auth-gated-filter'
import { useUserLists } from '../hooks/use-user-lists'
import type { SearchFiltersState } from '../types/problem-library-types'
import type { UserListDto } from '../types/user-list-types'
import { ManageListsModal, type ManageListsModalRef } from './ManageListsModal'
import { UserListMenuItems } from './UserListMenuItems'

/**
 * The props of {@link ListsDropdown}.
 */
type ListsDropdownProps = {
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Applies a change the user made in the dropdown. */
  onFiltersChange: (filters: SearchFiltersState) => void
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName?: string | null
}

/**
 * Picks which body of problems the library is showing: everything, the ones the user has
 * liked, or one of their lists.
 *
 * Everything but the first needs an account, so a signed-out user gets a sign-in prompt
 * that carries the choice they were making, and lands back on it afterwards.
 */
export function ListsDropdown({ filters, onFiltersChange, sharedListName }: ListsDropdownProps) {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  // Whether anybody is signed in
  const { isSignedIn } = useAuth()

  // A function which applies a filter only a signed-in reader may have
  const { applyOrPrompt } = useAuthGatedFilter(onFiltersChange)

  // Whether the dropdown is showing
  const [open, setOpen] = useState(false)

  // Whether the list menu has its new-list field open
  const [isCreating, setIsCreating] = useState(false)

  // The user's own lists, which only exist once they are signed in
  const { lists, likedCount, isLoading: isListsLoading } = useUserLists()

  // The modal for renaming and deleting lists
  const manageRef = useRef<ManageListsModalRef>(null)

  // A function which hands over to the manage-lists modal
  const handleManage = () => {
    // The dropdown goes first, so it isn't left hanging behind the modal
    setOpen(false)

    // Then the modal itself
    manageRef.current?.open()
  }

  // What the trigger reads, left blank until the lists it may name have arrived
  const currentLabel = isListsLoading
    ? ''
    : getCurrentLabel(filters, lists ?? [], sharedListName, t)

  // A list the user is browsing but does not own, which someone shared with them
  const isSharedList =
    !!filters.listContentId && !lists?.some((list) => list.contentId === filters.listContentId)

  // The icon standing for whichever body of problems is showing
  const CurrentIcon = filters.favoritesOnly ? Heart : isSharedList ? Share2 : List

  // A function which goes back to showing the whole library
  const handleSelectAll = () => {
    // Both of the narrowing filters go, since neither applies to the whole library
    onFiltersChange({ ...filters, favoritesOnly: false, listContentId: null })

    // The choice is made, so the dropdown closes behind it
    setOpen(false)
  }

  // A function which shows only the problems the user has liked
  const handleSelectLiked = () => {
    // Liking is the user's own, so a signed-out one is asked to sign in and brought back to this
    // same choice. Any list filter gives way to it either way, since the two narrow differently.
    const wasAnswered = applyOrPrompt(
      { ...filters, favoritesOnly: true, listContentId: null },
      t('viewFavoritesAuthReason')
    )

    // Whichever way it went, nothing is left hanging open behind an answered choice
    if (wasAnswered) setOpen(false)
  }

  // A function which shows only the problems on one of the user's lists
  const handleSelectList = (contentId: string) => {
    // The liked filter gives way, since the two narrow the library differently
    onFiltersChange({ ...filters, favoritesOnly: false, listContentId: contentId })

    // The choice is made, so the dropdown closes behind it
    setOpen(false)
  }

  // Whether the whole library is showing, which is what neither filter being set means
  const isAllActive = !filters.favoritesOnly && !filters.listContentId

  // The trigger can only name a list once the lists have arrived, so until then it waits
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

          {/* Custom lists and new-list creation */}
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
 * Names whatever the library is currently narrowed to.
 *
 * @param filters - The current filter state.
 * @param lists - The user's own lists.
 * @param sharedListName - The name of a list someone shared with the user.
 * @param t - The translation function.
 * @returns The name the trigger reads under.
 */
function getCurrentLabel(
  filters: SearchFiltersState,
  lists: UserListDto[],
  sharedListName: string | null | undefined,
  t: ReturnType<typeof useTranslations<'problems.filters'>>
): string {
  // The liked view reads under a fixed name
  if (filters.favoritesOnly) return t('myFavorites')

  // A list narrows the library, and carries its own name
  if (filters.listContentId) {
    const list = lists.find((list) => list.contentId === filters.listContentId)

    // One of the user's own lists
    if (list) return list.name

    // A list someone shared, which carries its own name
    if (sharedListName) return sharedListName

    // Neither set knows the list, so it reads as a shared one
    return t('sharedListLabel')
  }

  // Nothing narrows the library, so it reads as everything
  return t('allProblems')
}
