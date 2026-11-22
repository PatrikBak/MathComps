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

/**
 * An empty set of list ids that keeps its identity, so the store selector falling back to it reads as unchanged.
 */
const EMPTY_ARRAY: string[] = []

/**
 * The props every mode takes.
 */
type EveryModeProps = {
  /** Opens the list manager. */
  onManage: () => void
  /** Called when the new-list field opens or closes. */
  onCreatingChange?: (isCreating: boolean) => void
}

/**
 * The props of filter mode, where picking a list filters the library by it.
 */
type FilterModeProps = EveryModeProps & {
  /** The discriminator */
  mode: 'filter'
  /** The content id of the list being filtered by, or null for none. */
  activeContentId: string | null
  /** Called when a list is selected */
  onSelectList: (contentId: string) => void
  /** Called to close the parent popover */
  onClose: () => void
}

/**
 * The props of membership mode, where each row puts the problem on its list or takes it off, checked where the problem
 * already is.
 */
type MembershipModeProps = EveryModeProps & {
  /** The discriminator */
  mode: 'membership'
  /** The slug of the problem being managed */
  problemSlug: string
}

/**
 * Props for {@link UserListMenuItems} — discriminated union on `mode`.
 */
type UserListMenuItemsProps = FilterModeProps | MembershipModeProps

/**
 * The rows of a lists menu: one per list of the reader's, a row creating a new list and one opening the list manager,
 * in either filter or membership mode.
 */
export function UserListMenuItems(props: UserListMenuItemsProps) {
  // Translations for the filters
  const t = useTranslations('problems.filters')

  // Whether anyone is signed in
  const { isSignedIn } = useAuth()

  // A function which asks the reader to sign in
  const showLoginPrompt = useLoginPromptToast()

  // The form for naming a new list
  const newListForm = useNewListForm({ onCreatingChange: props.onCreatingChange })

  // The reader's lists
  const { lists, isLoading: isListsLoading } = useUserLists()

  // A function which puts the problem on a list or takes it off
  const toggleListItem = useToggleListItem()

  // The lists the problem is in, by content id, none in filter mode
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
                  // A list picked in filter mode filters the library
                  if (props.mode === 'filter') {
                    // The library, filtered by the list
                    props.onSelectList(list.contentId)

                    // Nothing to toggle
                    return
                  }

                  // Membership mode: toggle this problem's membership in the list
                  toggleListItem(props.problemSlug, list.contentId)
                }}
                className={cn(isActive && 'text-brand-light')}
              >
                <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2 pr-6">
                    {props.mode === 'membership' && isActive ? (
                      // Membership mode, active: checkmark
                      <Check className="h-4 w-4 shrink-0 text-brand-light" />
                    ) : (
                      // All other cases: layers icon with highlight when active
                      <Layers
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-brand-light' : 'text-muted'
                        )}
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

      {/* New list and Manage lists, once the lists have loaded */}
      {!isListsLoading && (
        <>
          {/* Separator only when there are items above (lists or mode=filter has All/Liked) */}
          {(props.mode === 'filter' || (lists && lists.length > 0)) && <PopoverSeparator />}

          {/* New list, its button and its field in one grid cell, so the wider of the two sets the width */}
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
                // A signed-out reader is asked to sign in instead
                if (!isSignedIn) {
                  // The prompt, saying what the account is for
                  showLoginPrompt({ reason: t('newListAuthReason') })

                  // Close the parent popover if in filter mode
                  if (props.mode === 'filter') {
                    props.onClose()
                  }

                  // Nothing to reveal
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
          {isSignedIn && lists && lists.length > 0 && (
            <PopoverItem
              disabled={newListForm.isCreating}
              onClick={props.onManage}
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
