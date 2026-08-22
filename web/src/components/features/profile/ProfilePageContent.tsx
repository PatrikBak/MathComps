'use client'

import { SignOutButton, useUser } from '@clerk/nextjs'
import { CalendarDays, LogOut, Mail } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useInvalidateUserComments } from '@/components/features/comments/hooks/use-invalidate-user-comments'
import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { getClerkErrorMessage } from '@/components/shared/utils/clerk-utils'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'

import { UsernameForm } from './components/UsernameForm'
import { useSetUsername } from './hooks/use-set-username'
import { useUserProfile } from './hooks/use-user-profile'
import { PROFILE_AVATAR_GLOW, PROFILE_BANNER_GRADIENT } from './profile-colors'

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
    <div className="text-foreground font-medium text-base md:text-right flex items-center justify-start md:justify-end gap-2 pt-4 md:pt-0">
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
  // Translations for Clerk auth errors
  const tClerkErrors = useTranslations('clerkErrors')

  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // Get a function to redirect to the login page
  const { redirectToLogin } = useLoginRedirect()

  // Load user data from Clerk
  const { user, isLoaded } = useUser()

  // The name the site calls them by
  const { username } = useUserProfile()

  // The one chance to choose it
  const { setUsername, isSaving: isSavingUsername } = useSetUsername()

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
  const containerClassName = 'py-2 px-3 bg-surface/30 rounded-lg border border-foreground/10'
  /** The class for the read-only data fields */
  const readOnlyContainerClassName = cn(
    containerClassName,
    'truncate text-muted cursor-not-allowed'
  )

  return (
    <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl bg-surface/50 rounded-2xl border border-surface-inset/60 overflow-hidden shadow-xl backdrop-blur-sm">
        {/* Header with Avatar */}
        <div className={cn('relative h-24 sm:h-28 md:h-32', PROFILE_BANNER_GRADIENT)}>
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
              <div
                className={cn(
                  'absolute -inset-0.5 rounded-full opacity-75 group-hover:opacity-100 transition duration-200 blur',
                  PROFILE_AVATAR_GLOW
                )}
              ></div>

              {/* Avatar image */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full ring-4 ring-background overflow-hidden bg-surface">
                <UserAvatarImage
                  imageUrl={user.imageUrl}
                  altText={username || user.firstName || tProfile('defaultUser')}
                  size={128}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* User info Grid */}
        <div className="px-4 sm:px-6 md:px-12 pb-8 sm:pb-10 md:pb-12 pt-16 sm:pt-20 md:pt-24">
          {/* Who the site knows them as */}
          <div className="flex flex-col items-center gap-2 pb-8 md:pb-10">
            {username ? (
              <h1 className="text-2xl font-semibold text-foreground">{username}</h1>
            ) : (
              <>
                <p className="max-w-md text-pretty text-center text-sm text-muted">
                  {tProfile('usernamePrompt')}
                </p>
                <UsernameForm onSubmit={setUsername} isSaving={isSavingUsername} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(250px,1fr)] justify-items-start items-center gap-x-8 gap-y-4 md:gap-y-9 [&>div:nth-child(2n)]:w-full">
            {/* Email label */}
            <ProfileInfoField icon={Mail} label={tProfile('email')} />

            {/* Email */}
            <div className={readOnlyContainerClassName}>
              <span className={commonFontStyle}>{user.primaryEmailAddress?.emailAddress}</span>
            </div>

            {/* Member since label */}
            <ProfileInfoField icon={CalendarDays} label={tProfile('memberSince')} />

            {/* Member since */}
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
        <div className="py-6 border-t border-foreground/10 flex flex-col items-center gap-4">
          <SignOutButton redirectUrl={ROUTES.HOME}>
            <button
              className={cn(
                'inline-flex items-center justify-center gap-2',
                'rounded-lg font-medium transition-all duration-200',
                'px-5 py-2.5 text-sm text-error',
                'bg-error/10 hover:bg-error/15',
                'border border-error/20 hover:border-error/30',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-error/40 focus-visible:ring-offset-inset'
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
