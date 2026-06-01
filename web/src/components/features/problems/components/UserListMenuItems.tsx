'use client'

import { useAuth } from '@clerk/nextjs'
import { Check, Layers, Plus, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/shared/components/DropdownMenu'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { useProblemStore } from '@/stores/problem-store'

import { useCreateUserList } from '../hooks/use-create-user-list'
import { useToggleListItem } from '../hooks/use-toggle-list-item'
import { useUserLists } from '../hooks/use-user-lists'
import { listNameSchema } from '../schemas/user-list-schemas'

/*
 * Stable empty array to avoid re-rendering when lists are empty.
 */
const EMPTY_ARRAY: string[] = []

/**
 * Filter mode — used in a dropdown where we can select a list to filter by.
 */
type FilterModeProps = {
  /** The discriminator */
  mode: 'filter'
  /** The currently-active list contentId (for highlight) */
  activeContentId: string | null
  /** Called when a list is selected */
  onSelectList: (contentId: string) => void
  /** Called to close the parent dropdown */
  onClose: () => void
  /** Called when 'Manage lists' is clicked */
  onManage?: () => void
  /** Called when entering/leaving creation mode (so parent can disable its own items) */
  onCreatingChange?: (isCreating: boolean) => void
}

/**
 * Membership mode, shows checkmarks for problem that are there.
 */
type MembershipModeProps = {
  /** The discriminator */
  mode: 'membership'
  /** The slug of the problem being managed */
  problemSlug: string
  /** Called when 'Manage lists' is clicked */
  onManage?: () => void
  /** Called when entering/leaving creation mode (so parent can disable its own items) */
  onCreatingChange?: (isCreating: boolean) => void
}

/**
 * Props for {@link UserListMenuItems} — discriminated union on `mode`.
 */
type UserListMenuItemsProps = FilterModeProps | MembershipModeProps

/**
 * Shared menu items for user lists.
 */
export function UserListMenuItems(props: UserListMenuItemsProps) {
  // Translations
  const t = useTranslations('problems.filters')

  // Auth state
  const { isSignedIn } = useAuth()

  // Login prompt
  const showLoginPrompt = useLoginPromptToast()

  // Whether we're in "new list" mode
  const [isCreating, setIsCreatingRaw] = useState(false)

  // Wrapper that notifies the parent in the same render batch
  const setIsCreating = (value: boolean) => {
    setIsCreatingRaw(value)
    props.onCreatingChange?.(value)
  }

  // The current name of the new list
  const [newListName, setNewListName] = useState('')

  // The ref to the input where we're typing the new list name
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch user lists
  const { lists, isLoading: isListsLoading } = useUserLists()

  // Create list mutation
  const { createList, isPending: isCreatePending } = useCreateUserList()

  // Toggle list item mutation (only used in membership mode)
  const toggleListItem = useToggleListItem()

  // Membership data from store
  const listContentIds = useProblemStore((state) =>
    props.mode === 'membership'
      ? (state.problems[props.problemSlug]?.listContentIds ?? EMPTY_ARRAY)
      : EMPTY_ARRAY
  )

  // Focus the input when entering creation mode (after Radix's own focus pass)
  useEffect(() => {
    if (isCreating) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [isCreating])

  return (
    <>
      {/* Custom lists (only when signed in and lists exist) */}
      {isSignedIn && lists && lists.length > 0 && (
        <>
          {lists.map((list) => {
            // Determine active/checked state based on mode
            const isActive =
              props.mode === 'filter'
                ? props.activeContentId === list.contentId
                : listContentIds.includes(list.contentId)

            return (
              <DropdownMenuItem
                key={list.contentId}
                disabled={isCreating}
                onSelect={(event) => {
                  if (props.mode === 'filter') {
                    // Filter mode: select list and close
                    props.onSelectList(list.contentId)
                  } else {
                    // Membership mode: toggle and keep open
                    event.preventDefault()
                    toggleListItem(props.problemSlug, list.contentId)
                  }
                }}
                className={cn('cursor-pointer', isActive && 'text-focus-light')}
              >
                <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2 pr-6">
                    {props.mode === 'membership' && isActive ? (
                      // Membership mode, active: checkmark
                      <Check className="h-4 w-4 shrink-0 text-focus" />
                    ) : (
                      // All other cases: layers icon with highlight when active
                      <Layers
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-focus' : 'text-muted')}
                      />
                    )}
                    <TruncatedText className="truncate text-sm">{list.name}</TruncatedText>
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">
                    {list.problemCount}
                  </span>
                </div>
              </DropdownMenuItem>
            )
          })}
        </>
      )}

      {/* Loading indicator when fetching lists */}
      {isSignedIn && isListsLoading && (
        <>
          <DropdownMenuSeparator />
          <div className="flex items-center justify-center py-2">
            <LoadingSpinner className="h-4 w-4" />
          </div>
        </>
      )}

      {/* New list + Manage lists — always visible, auth-gated */}
      {!isListsLoading && (
        <>
          {/* Separator only when there are items above (lists or mode=filter has All/Liked) */}
          {(props.mode === 'filter' || (lists && lists.length > 0)) && <DropdownMenuSeparator />}

          {/* New list — grid overlay: both button and input occupy the same cell,
             so the wider one always defines the width (prevents horizontal shift) */}
          <div className="grid">
            {/* Input for typing the new list name */}
            <div
              className={cn(
                'relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm gap-2 col-start-1 row-start-1',
                !isCreating && 'invisible'
              )}
            >
              <Plus className="h-4 w-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                onKeyDown={(event) => {
                  // Stop propagation so Radix's typeahead doesn't intercept keystrokes
                  event.stopPropagation()

                  // Enter → create list
                  if (event.key === 'Enter') {
                    // Prevent dropdown submission
                    event.preventDefault()

                    // Validate with shared schema
                    const result = listNameSchema.safeParse(newListName)

                    // Show error if invalid
                    if (!result.success) {
                      toast.error(t('listNameInvalid'))
                      return
                    }

                    // Create the list (reset state after the mutation succeeds,
                    // so the input stays visible until the new list is in the cache)
                    createList(result.data, {
                      onSuccess: () => {
                        setNewListName('')
                        setIsCreating(false)
                      },
                    })
                  }
                  // Escape → cancel
                  if (event.key === 'Escape') {
                    // Prevent dropdown submission
                    event.preventDefault()

                    // Reset the list state
                    setNewListName('')
                    setIsCreating(false)
                  }
                }}
                placeholder={t('newListPlaceholder')}
                disabled={isCreatePending}
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder-muted border-none outline-none focus:ring-0"
              />
              <LoadingSpinner className={cn('h-4 w-4 shrink-0', !isCreatePending && 'invisible')} />
            </div>

            {/* Button to reveal the input (visible when not creating) */}
            <DropdownMenuItem
              disabled={isCreating}
              onSelect={(event) => {
                // Prevent the dropdown from closing
                event.preventDefault()

                // Auth gate: show login prompt for unsigned users
                if (!isSignedIn) {
                  showLoginPrompt({ reason: t('newListAuthReason') })

                  // Close the parent dropdown if in filter mode
                  if (props.mode === 'filter') {
                    props.onClose()
                  }
                  return
                }

                // Signed in: reveal the input
                setIsCreating(true)
              }}
              className={cn(
                'cursor-pointer text-muted hover:text-foreground col-start-1 row-start-1',
                isCreating && 'invisible'
              )}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>{t('newList')}</span>
              </div>
            </DropdownMenuItem>
          </div>

          {/* Manage lists — only when signed in and lists exist */}
          {isSignedIn && props.onManage && lists && lists.length > 0 && (
            <DropdownMenuItem
              disabled={isCreating}
              onSelect={() => props.onManage?.()}
              className="cursor-pointer text-muted hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>{t('manageLists')}</span>
              </div>
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  )
}
