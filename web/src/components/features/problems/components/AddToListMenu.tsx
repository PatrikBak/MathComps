'use client'

import { useAuth } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import { type ReactNode, useRef, useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shared/components/Popover'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import { ManageListsModal, type ManageListsModalRef } from './ManageListsModal'
import { UserListMenuItems } from './UserListMenuItems'

/**
 * Props for {@link AddToListMenu}
 */
type AddToListMenuProps = {
  /** The slug of the problem to manage list membership for */
  problemSlug: string
  /** The button's icon. */
  icon: ReactNode
  /** Callback when a list is selected for viewing (filter navigation) */
  onSelectList: (contentId: string) => void
}

/**
 * A button on a problem's card opening a menu that puts the problem on the reader's lists and takes it off them. A
 * signed-out reader gets a sign-in prompt instead.
 */
export function AddToListMenu({ problemSlug, icon, onSelectList }: AddToListMenuProps) {
  // Whether auth has settled, and whether anyone is signed in
  const { isLoaded, isSignedIn } = useAuth()

  // A function which asks the reader to sign in
  const showLoginPrompt = useLoginPromptToast()

  // Problems library translations
  const t = useTranslations('problems')

  // Whether the menu is open
  const [open, setOpen] = useState(false)

  // The list manager
  const manageRef = useRef<ManageListsModalRef>(null)

  // A function which opens the list manager
  const handleManage = () => {
    // The menu goes first, so it isn't left behind the manager
    setOpen(false)

    // The list manager, opened
    manageRef.current?.open()
  }

  // A function which answers a press on the button
  const handleTriggerClick = () => {
    // Nothing to decide until auth settles
    if (!isLoaded) return

    // A signed-out reader is asked to sign in instead
    if (!isSignedIn) {
      // The prompt, saying what the account is for
      showLoginPrompt({ reason: t('addToListAuthReason') })

      // The menu stays shut
      return
    }

    // Signed in: the menu opens, or closes
    setOpen((wasOpen) => !wasOpen)
  }

  return (
    <div>
      {/* Lists menu */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleTriggerClick} title={t('addToList')}>
            {icon}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="min-w-48 !animate-none">
          <UserListMenuItems mode="membership" problemSlug={problemSlug} onManage={handleManage} />
        </PopoverContent>
      </Popover>

      {/* List manager */}
      <ManageListsModal ref={manageRef} onSelectList={onSelectList} />
    </div>
  )
}
