'use client'

import { useAuth } from '@clerk/nextjs'
import { Check, Layers, Plus, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { PopoverItem, PopoverSeparator } from '@/components/shared/components/Popover'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { useProblemStore } from '@/stores/problem-store'

import { useNewListForm } from '../hooks/use-new-list-form'
import { useToggleListItem } from '../hooks/use-toggle-list-item'
import { useUserLists } from '../hooks/use-user-lists'
import { NewListInput } from './NewListInput'

/*
 * Stable empty array to avoid re-rendering when lists are empty.
 */
const EMPTY_ARRAY: string[] = []

/**
 * Filter mode — used in a popover where we can select a list to filter by.
 */
type FilterModeProps = {
  /** The discriminator */
  mode: 'filter'
  /** The currently-active list contentId (for highlight) */
  activeContentId: string | null
  /** Called when a list is selected */
  onSelectList: (contentId: string) => void
  /** Called to close the parent popover */
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
 * Shared list rows for the lists popover — one row per user list plus inline list
 * creation, rendered in either filter or membership mode.
 */
export function UserListMenuItems(props: UserListMenuItemsProps) {
  // Translations
  const t = useTranslations('problems.filters')

  // Auth state
  const { isSignedIn } = useAuth()

  // Login prompt
  const showLoginPrompt = useLoginPromptToast()

  // The form for naming a new list
  const newListForm = useNewListForm({ onCreatingChange: props.onCreatingChange })

  // Fetch user lists
  const { lists, isLoading: isListsLoading } = useUserLists()

  // Toggle list item mutation (only used in membership mode)
  const toggleListItem = useToggleListItem()

  // Membership data from store
  const listContentIds = useProblemStore((state) =>
    props.mode === 'membership'
      ? (state.problems[props.problemSlug]?.listContentIds ?? EMPTY_ARRAY)
      : EMPTY_ARRAY
  )

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
              <PopoverItem
                key={list.contentId}
                disabled={newListForm.isCreating}
                onClick={() => {
                  // Filter mode: filter by the selected list
                  if (props.mode === 'filter') {
                    props.onSelectList(list.contentId)
                    return
                  }

                  // Membership mode: toggle this problem's membership in the list
                  toggleListItem(props.problemSlug, list.contentId)
                }}
                className={cn(isActive && 'text-focus-light')}
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
                    <TruncatedText className="text-sm">{list.name}</TruncatedText>
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">
                    {list.problemCount}
                  </span>
                </div>
              </PopoverItem>
            )
          })}
        </>
      )}

      {/* Loading indicator when fetching lists */}
      {isSignedIn && isListsLoading && (
        <>
          <PopoverSeparator />
          <div className="flex items-center justify-center py-2">
            <LoadingSpinner className="h-4 w-4" />
          </div>
        </>
      )}

      {/* New list + Manage lists — always visible, auth-gated */}
      {!isListsLoading && (
        <>
          {/* Separator only when there are items above (lists or mode=filter has All/Liked) */}
          {(props.mode === 'filter' || (lists && lists.length > 0)) && <PopoverSeparator />}

          {/* New list — grid overlay: both button and input occupy the same cell,
             so the wider one always defines the width (prevents horizontal shift) */}
          <div className="grid">
            {/* Input for typing the new list name */}
            <NewListInput
              form={newListForm}
              className={cn(
                'relative col-start-1 row-start-1',
                !newListForm.isCreating && 'invisible'
              )}
            />

            {/* Button to reveal the input (visible when not creating) */}
            <PopoverItem
              disabled={newListForm.isCreating}
              onClick={() => {
                // Auth gate: show login prompt for unsigned users
                if (!isSignedIn) {
                  showLoginPrompt({ reason: t('newListAuthReason') })

                  // Close the parent popover if in filter mode
                  if (props.mode === 'filter') {
                    props.onClose()
                  }
                  return
                }

                // Signed in: reveal the input
                newListForm.start()
              }}
              className={cn(
                'col-start-1 row-start-1 text-muted',
                newListForm.isCreating && 'invisible'
              )}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>{t('newList')}</span>
              </div>
            </PopoverItem>
          </div>

          {/* Manage lists — only when signed in and lists exist */}
          {isSignedIn && props.onManage && lists && lists.length > 0 && (
            <PopoverItem
              disabled={newListForm.isCreating}
              onClick={() => props.onManage?.()}
              className="text-muted"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>{t('manageLists')}</span>
              </div>
            </PopoverItem>
          )}
        </>
      )}
    </>
  )
}
