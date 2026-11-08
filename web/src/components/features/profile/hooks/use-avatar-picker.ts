'use client'

import { useUser } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { useInvalidateUserComments } from '@/components/features/comments/hooks/use-invalidate-user-comments'
import { getClerkErrorMessage } from '@/components/shared/utils/clerk-utils'
import { useFilePicker } from '@/hooks/use-file-picker'

/**
 * Return type for the {@link useAvatarPicker} hook.
 */
type UseAvatarPickerResult = {
  /** Asks for the picker, unless it is already on its way or a picked image is still being saved. */
  open: () => void
  /** Whether the picker is on its way or a picked image is being saved. */
  isBusy: boolean
}

/**
 * The picker for the signed-in user's new avatar, which takes the image picked as their profile picture. It
 * stays busy from the press until the picture is saved, so a second pick cannot race the first.
 *
 * @returns The opener, and whether the avatar is busy.
 */
export function useAvatarPicker(): UseAvatarPickerResult {
  // Profile copy
  const tProfile = useTranslations('profile')

  // Translations for Clerk auth errors
  const tClerkErrors = useTranslations('clerkErrors')

  // The signed-in user
  const { user } = useUser()

  // A function which refreshes everything this user has signed
  const { invalidateUserComments } = useInvalidateUserComments()

  // Whether a picked image is being saved
  const [isSaving, setIsSaving] = useState(false)

  /**
   * A function which makes the picked image the user's profile picture.
   *
   * @param files - The files picked, the first of which becomes the picture.
   */
  const setAvatar = async (files: File[]) => {
    // Nobody signed in to take it
    if (!user) return

    // The save starts
    setIsSaving(true)

    // The picture saved, or the reason it was not
    try {
      // The image becomes the user's profile picture
      await user.setProfileImage({ file: files[0] })

      // Their comments refresh, to show it
      await invalidateUserComments()

      // The user is told it took
      toast.success(tProfile('avatarUpdated'))
    } catch (error) {
      // The user is told why it did not
      toast.error(getClerkErrorMessage(error, tClerkErrors))
    } finally {
      // The save is over, however it ended
      setIsSaving(false)
    }
  }

  // The system's picker, on images and one at a time
  const picker = useFilePicker({
    accept: 'image/*',
    multiple: false,
    onPick: (files) => void setAvatar(files),
  })

  /**
   * A function which asks for the picker, unless a picked image is still being saved.
   */
  const open = () => {
    // The last pick still being saved
    if (isSaving) return

    // The picker asked for
    picker.open()
  }

  // Busy while the picker comes up, and while what it gave is saved
  const isBusy = picker.isOpening || isSaving

  // The opener and whether the avatar is busy
  return { open, isBusy }
}
