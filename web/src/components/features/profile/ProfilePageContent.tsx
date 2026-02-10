'use client'

import { SignOutButton, useUser } from '@clerk/nextjs'
import { CalendarDays, LogOut, Mail, User } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { createDisplayNameSchema } from '@/components/features/auth/authFormSchema'
import { useInvalidateUserComments } from '@/components/features/comments/hooks/use-invalidate-user-comments'
import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { EditableTextField } from '@/components/shared/components/EditableTextField'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { getClerkErrorMessage } from '@/components/shared/utils/clerk-utils'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'

/**
 * Props for the ProfileInfoField component
 */
type ProfileInfoFieldProps = {
  /** The icon to display */
  icon: React.ElementType
  /** The label to display */
  label: string
}

/**
 * A component that displays a profile info field
 */
function ProfileInfoField({ icon: Icon, label }: ProfileInfoFieldProps) {
  return (
    <div className="text-slate-200 font-medium text-base md:text-right flex items-center justify-start md:justify-end gap-2 pt-4 md:pt-0">
      <Icon className="w-5 h-5" />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  )
}

/**
 * Content component for the profile page.
 * Displays user avatar, info, and sign-out button.
 */
export default function ProfilePageContent() {
  // Translations for profile page
  const tProfile = useTranslations('profile')
  // Translations for auth-related strings
  const tAuth = useTranslations('auth')
  // Translations for validation errors
  const tValidation = useTranslations('validation')
  // Translations for Clerk auth errors
  const tClerkErrors = useTranslations('clerkErrors')

  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // Get a function to redirect to the login page
  const { redirectToLogin } = useLoginRedirect()

  // Load user data from Clerk
  const { user, isLoaded } = useUser()

  // Ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hook for invalidating user comments
  const { invalidateUserComments } = useInvalidateUserComments()

  // If no user is logged in, redirect to the login page
  useEffect(() => {
    if (isLoaded && !user) {
      redirectToLogin()
    }
  }, [isLoaded, user, redirectToLogin])

  // A loading spinner while Clerk is loading user data
  if (!isLoaded) {
    return <LoadingSpinner />
  }

  // To render anything, we need to have a user...If we don't, the
  // useEffect above will redirect us to the login page
  if (!user) {
    return null
  }

  /**
   * Updates the user's display name
   *
   * @param newName The new display name
   */
  const onUpdateDisplayName = async (newName?: string) => {
    // We need to have something to update
    if (!user || !newName) return

    try {
      // Issue the update...
      // Forget the last name (that might have come from social login)
      await user.update({
        firstName: newName,
        lastName: '',
      })

      // Invalidate comments to refresh author name
      await invalidateUserComments()
    } catch (error) {
      // Throw a new error with the friendly message so EditableTextField can display it
      throw new Error(getClerkErrorMessage(error, tClerkErrors))
    }
  }

  /**
   * Handles the file selection for avatar update
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Get the file from the input
    const file = event.target.files?.[0]

    // Ensure we have both the file and the user
    if (!file || !user) return

    try {
      // Use Clerk's API to update the user's profile image
      await user.setProfileImage({ file })

      // Invalidate comments to refresh avatars
      await invalidateUserComments()

      // This worked out fine
      toast.success(tProfile('avatarUpdated'))
    } catch (error) {
      toast.error(getClerkErrorMessage(error, tClerkErrors))
    }
  }

  /** The class for the font of the text inside the data fields */
  const commonFontStyle = 'truncate text-base font-medium'
  /** The class for the container of the data fields */
  const containerClassName = 'py-2 px-3 bg-slate-800/30 rounded-lg border border-slate-800'
  /** The class for the read-only data fields */
  const readOnlyContainerClassName = cn(
    containerClassName,
    'truncate text-slate-500 cursor-not-allowed'
  )

  return (
    <div className="flex items-center justify-center px-4 py-8 sm:py-12 md:py-16 lg:py-20 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl bg-slate-900/95 rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl backdrop-blur-sm">
        {/* Header with Avatar */}
        <div className="relative h-24 sm:h-28 md:h-32 bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-pink-900/40">
          {/* Texture Overlay */}
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          ></div>

          {/* Avatar container */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 sm:-bottom-14 md:-bottom-16 z-10 flex flex-col items-center">
            {/* Avatar file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />

            {/* Clickable avatar container */}
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {/* Avatar gradient */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>

              {/* Avatar image */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full ring-4 ring-slate-900 overflow-hidden bg-slate-800">
                <UserAvatarImage
                  imageUrl={user.imageUrl}
                  altText={user.firstName || tProfile('defaultUser')}
                  size={128}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* User info Grid */}
        <div className="px-4 sm:px-6 md:px-12 pb-8 sm:pb-10 md:pb-12 pt-16 sm:pt-20 md:pt-30">
          <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(250px,1fr)] justify-items-start items-center gap-x-8 gap-y-4 md:gap-y-9 [&>div:nth-child(2n)]:w-full">
            {/* Row 1, Col 1 - Display name label */}
            <ProfileInfoField icon={User} label={tProfile('displayName')} />

            {/* Row 1, Col 2 - Display name input */}
            <EditableTextField
              value={user.firstName || ''}
              onSave={onUpdateDisplayName}
              schema={createDisplayNameSchema(tValidation)}
              label={tProfile('displayNamePlaceholder')}
              textClassName={cn(commonFontStyle, 'text-slate-200')}
              innerContainerClassName={containerClassName}
              iconSize={14}
              actionsClassName="pr-1"
            />

            {/* Row 2, Col 1 - Email label */}
            <ProfileInfoField icon={Mail} label={tProfile('email')} />

            {/* Row 2, Col 2 - Email read-only */}
            <div className={readOnlyContainerClassName}>
              <span className={commonFontStyle}>{user.primaryEmailAddress?.emailAddress}</span>
            </div>

            {/* Row 3, Col 1 - Member since label */}
            <ProfileInfoField icon={CalendarDays} label={tProfile('memberSince')} />

            {/* Row 3, Col 2 - Member since read-only */}
            <div className={readOnlyContainerClassName}>
              <span className={commonFontStyle}>
                {user?.createdAt &&
                  format.dateTime(new Date(user.createdAt), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
              </span>
            </div>
          </div>
        </div>

        {/* Sign out button */}
        <div className="py-6 border-t border-slate-800 flex flex-col items-center gap-4">
          <SignOutButton redirectUrl={ROUTES.HOME}>
            <button
              className={cn(
                'inline-flex items-center justify-center gap-2',
                'rounded-lg font-medium transition-all duration-200',
                'px-5 py-2.5 text-sm text-red-400',
                'bg-red-950/20 hover:bg-red-900/30',
                'border border-red-900/30 hover:border-red-800/50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-red-900/40 focus-visible:ring-offset-slate-900'
              )}
            >
              <LogOut className="w-4 h-4" />
              <span>{tAuth('signOut')}</span>
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  )
}
