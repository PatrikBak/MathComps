'use client'

import { useUser } from '@clerk/nextjs'
import { CalendarDays, GraduationCap, Mail, MapPin } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { useInvalidateUserComments } from '@/components/features/comments/hooks/use-invalidate-user-comments'
import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { SearchableSelect } from '@/components/shared/components/select/SearchableSelect'
import { Select } from '@/components/shared/components/select/Select'
import { getClerkErrorMessage } from '@/components/shared/utils/clerk-utils'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginRedirect } from '@/hooks/use-login-redirect'

import { UsernameForm } from './components/UsernameForm'
import { getCountryOptions } from './countries'
import { getGraduationYears, PAST_SCHOOL_VALUE } from './graduation-year'
import { useSetUsername } from './hooks/use-set-username'
import { useUpdateProfile } from './hooks/use-update-profile'
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
  /** Why the field is being asked, when that is not obvious from the label */
  help?: string
}

/**
 * A component that displays a profile info field
 */
function ProfileInfoField({ icon: Icon, label, help }: ProfileInfoFieldProps) {
  return (
    <div className="text-foreground font-medium text-base md:text-right flex items-center justify-start md:justify-end gap-2 pt-4 md:pt-0">
      <Icon className="w-5 h-5" />
      <span className="whitespace-nowrap">{label}</span>
      {help !== undefined && <HelpTooltip content={help} label={label} />}
    </div>
  )
}

/**
 * Props for the {@link ProfileSection} component
 */
type ProfileSectionProps = {
  /** What the section is called */
  title: string
  /** One line saying what the section's fields are for, or who can see them */
  note: string
  /** The label/field pairs the section holds */
  children: React.ReactNode
}

/**
 * A titled group of profile fields.
 */
function ProfileSection({ title, note, children }: ProfileSectionProps) {
  return (
    <section className="pt-6 md:pt-8">
      {/* Section title */}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>

      {/* What the section's fields are for */}
      <p className="mt-1 mb-5 text-pretty text-xs text-muted">{note}</p>

      {/* Label on the left, field on the right, stacking on a narrow screen */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(250px,1fr)] justify-items-start items-center gap-x-8 gap-y-4 md:gap-y-6 [&>div:nth-child(2n)]:w-full">
        {children}
      </div>
    </section>
  )
}

/**
 * The signed-in student's own page: who the site calls them, and what a competition needs to place them.
 *
 * The username is taken once, through a form that only appears while there is none. Every other field saves on
 * the pick.
 */
export default function ProfilePageContent() {
  // Translations for profile page
  const tProfile = useTranslations('profile')
  // Translations for Clerk auth errors
  const tClerkErrors = useTranslations('clerkErrors')

  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // Get a function to redirect to the login page
  const { redirectToLogin } = useLoginRedirect()

  // Load user data from Clerk
  const { user, isLoaded: isUserLoaded } = useUser()

  // The reader's language
  const locale = useLocale()

  // What the site holds on them
  const {
    username,
    graduationYear,
    hasLeftHighSchool,
    countryCode,
    isLoading: isProfileLoading,
  } = useUserProfile()

  // The one chance to choose the name
  const { setUsername, isSaving: isSavingUsername } = useSetUsername()

  // A function which saves what they say about their competing
  const { updateProfile } = useUpdateProfile()

  // The years on offer, with being past school as one of the answers
  const graduationYearOptions = useMemo(
    () => [
      ...getGraduationYears(new Date().getUTCFullYear()).map((year) => ({
        value: String(year),
        label: String(year),
      })),
      { value: PAST_SCHOOL_VALUE, label: tProfile('graduationYearPastSchool') },
    ],
    [tProfile]
  )

  // Every country, named and sorted in the reader's own language, theirs on top
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale])

  // Ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hook for invalidating user comments
  const { invalidateUserComments } = useInvalidateUserComments()

  // If no user is logged in, redirect to the login page
  useEffect(() => {
    if (isUserLoaded && !user) {
      redirectToLogin()
    }
  }, [isUserLoaded, user, redirectToLogin])

  // A loading spinner until both halves of who they are have arrived. Rendering on Clerk alone would offer the
  // name form to somebody who already has one, and would take a pick against fields nobody has read yet
  if (!isUserLoaded || isProfileLoading) {
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
          <div className="flex flex-col items-center gap-2">
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

          {/* Account section */}
          <ProfileSection title={tProfile('accountSection')} note={tProfile('accountNote')}>
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
          </ProfileSection>

          {/* Competition section */}
          <ProfileSection title={tProfile('competitionSection')} note={tProfile('competitionNote')}>
            {/* Graduation year label */}
            <ProfileInfoField
              icon={GraduationCap}
              label={tProfile('graduationYear')}
              help={tProfile('graduationYearHelp')}
            />

            {/* Graduation year, saved on the pick */}
            <div>
              <Select
                options={graduationYearOptions}
                value={
                  hasLeftHighSchool
                    ? PAST_SCHOOL_VALUE
                    : graduationYear === null
                      ? ''
                      : String(graduationYear)
                }
                onChange={(picked) =>
                  updateProfile({
                    graduationYear: picked === PAST_SCHOOL_VALUE ? null : Number(picked),
                    hasLeftHighSchool: picked === PAST_SCHOOL_VALUE,
                    countryCode,
                  })
                }
                placeholder={tProfile('graduationYearPlaceholder')}
              />
            </div>

            {/* Country label */}
            <ProfileInfoField icon={MapPin} label={tProfile('country')} />

            {/* Country, saved on the pick */}
            <div>
              <SearchableSelect
                options={countryOptions}
                value={countryCode ?? ''}
                onChange={(picked) =>
                  updateProfile({
                    graduationYear,
                    hasLeftHighSchool,
                    countryCode: picked === '' ? null : picked,
                  })
                }
                placeholder={tProfile('countryPlaceholder')}
                emptyMessage={tProfile('countryNoMatch')}
                ariaLabel={tProfile('country')}
              />
            </div>
          </ProfileSection>
        </div>
      </div>
    </div>
  )
}
