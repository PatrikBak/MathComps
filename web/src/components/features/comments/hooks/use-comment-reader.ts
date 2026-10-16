'use client'

import { useAuth } from '@clerk/nextjs'

import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'

/**
 * What {@link useCommentReader} hands back.
 */
type UseCommentReaderResult = {
  /** The reader's id, absent when signed out or until sign-in has settled. */
  userId: string | null | undefined
  /** Whether sign-in has settled who the reader is. */
  isSignInLoaded: boolean
  /** The name the reader signs comments with, null until they choose one. */
  username: string | null
  /** Whether both who the reader is and what they are called are known. */
  isIdentityLoaded: boolean
}

/**
 * Who reads a thread, and the name they sign comments with. The reader's identity counts as known only once their
 * profile has loaded too, since a missing name reads the same as an unread one.
 *
 * @returns The reader, their name, and how much of that is known yet.
 */
export function useCommentReader(): UseCommentReaderResult {
  // The reader, and whether Clerk has settled who they are
  const { userId, isLoaded: isSignInLoaded } = useAuth()

  // The reader's username, null until they choose one, and whether their profile is still loading
  const { username, isLoading: isProfileLoading } = useUserProfile()

  // Whether we know who is here and what they are called
  const isIdentityLoaded = isSignInLoaded && !isProfileLoading

  // The reader, their name, and how much of that is known
  return { userId, isSignInLoaded, username, isIdentityLoaded }
}
