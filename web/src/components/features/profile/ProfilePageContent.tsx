'use client'

import { SignOutButton, useUser } from '@clerk/nextjs'
import { LogOut, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'
import { getUserDisplayName } from '@/components/shared/utils/user-utils'
import { ROUTES } from '@/constants/routes'

/**
 * Content component for the profile page.
 * Displays user avatar, info, and sign-out button.
 */
export default function ProfilePageContent() {
  // Need a router for potential redirect to a login page
  const router = useRouter()

  // Load user data from Clerk
  const { user, isLoaded } = useUser()

  // If no user is logged in, redirect to the login page
  useEffect(() => {
    if (isLoaded && !user) {
      router.push(ROUTES.LOGIN)
    }
  }, [isLoaded, user, router])

  // A loading spinner while Clerk is loading user data
  if (!isLoaded) {
    return <LoadingSpinner />
  }

  // To render anything, we need to have a user...If we don't, the
  // useEffect above will redirect us to the login page
  if (!user) {
    return null
  }

  return (
    <div className="flex items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
      <div className="bg-slate-900/95 rounded-2xl border border-slate-700/60 overflow-hidden">
        {/* Avatar */}
        <div className="h-32 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 border-b border-slate-700/50 relative">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-32 h-32 rounded-full ring-4 ring-indigo-500/20">
            <UserAvatarImage
              imageUrl={user.imageUrl}
              altText={getUserDisplayName(user)}
              width={128}
              height={128}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* User info */}
        <div className="pt-20 pb-8 px-6 sm:px-8">
          <div className="text-center mb-8">
            {/* Name */}
            <div className="text-2xl font-semibold text-white">{getUserDisplayName(user)}</div>

            {/* Mail */}
            {user.primaryEmailAddress?.emailAddress && (
              <div className="flex items-center justify-center gap-2 text-slate-400 mt-3">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{user.primaryEmailAddress.emailAddress}</span>
              </div>
            )}
          </div>

          {/* Sign out button */}
          <div className="flex justify-center">
            <SignOutButton>
              <button
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'rounded-xl font-semibold transition-colors duration-200',
                  'px-6 py-3 text-base text-white',
                  'bg-red-700/60 hover:bg-red-700/70',
                  'border border-red-600/40 hover:border-red-600/50',
                  'backdrop-blur-sm',
                  'shadow-md hover:shadow-lg',
                  'active:scale-[0.98]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  'focus-visible:ring-red-600/40 focus-visible:ring-offset-slate-900'
                )}
              >
                <LogOut className={cn('w-5 h-5')} />
                <span>Odhlásiť sa</span>
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </div>
  )
}
