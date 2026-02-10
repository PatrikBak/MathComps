'use client'

import { useAuth } from '@clerk/nextjs'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import { ManageListsModal, type ManageListsModalRef } from './ManageListsModal'
import { UserListMenuItems } from './UserListMenuItems'

/**
 * Props for {@link AddToListMenu}
 */
type AddToListMenuProps = {
  /** The slug of the problem to manage list membership for */
  problemSlug: string
  /** Callback when a list is selected for viewing (filter navigation) */
  onSelectList: (contentId: string) => void
}

/**
 * "+" button dropdown on problem cards for adding/removing problems from lists.
 * Auth-gated: unauthenticated users get a login prompt on click.
 * Uses {@link UserListMenuItems} in membership mode.
 */
export function AddToListMenu({ problemSlug, onSelectList }: AddToListMenuProps) {
  // Auth state
  const { isLoaded, isSignedIn } = useAuth()

  // Login prompt
  const showLoginPrompt = useLoginPromptToast()

  // Translations
  const t = useTranslations('problems')

  // Dropdown open state
  const [open, setOpen] = useState(false)

  // Ref for the manage lists modal
  const manageRef = useRef<ManageListsModalRef>(null)

  // Open manage modal (close dropdown first)
  const handleManage = () => {
    setOpen(false)
    manageRef.current?.open()
  }

  // Handle trigger click with auth gating
  const handleTriggerClick = () => {
    // Wait for auth to load
    if (!isLoaded) return

    // Show login prompt for unauthenticated users
    if (!isSignedIn) {
      showLoginPrompt({ reason: t('addToListAuthReason') })
      return
    }

    // Signed in: toggle dropdown
    setOpen((prev) => !prev)
  }

  return (
    <div>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            onClick={handleTriggerClick}
            className={cn(
              '-ml-2 -mr-3 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all duration-200 rounded-md hover:bg-slate-700/50',
              'text-gray-400 hover:text-gray-200'
            )}
            title={t('addToList')}
          >
            <Plus size={14} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="min-w-48 !animate-none"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <UserListMenuItems mode="membership" problemSlug={problemSlug} onManage={handleManage} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manage Lists Modal */}
      <ManageListsModal ref={manageRef} onSelectList={onSelectList} />
    </div>
  )
}
