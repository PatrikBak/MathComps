'use client'

import { useAuth } from '@clerk/nextjs'

import type { UserIdentity } from '../model/user-identity'
import { useUserProfile } from './use-user-profile'

/**
 * The signed-in user as a reviewing surface names them, under their sign-in's id, which differs from the account id
 * every read from the server names them by.
 *
 * @returns Who is signed in, or null while nobody is.
 */
export function useSignedInIdentity(): UserIdentity | null {
  // Who is signed in
  const { userId } = useAuth()

  // The signed-in user's profile, with the name and email they go by
  const profile = useUserProfile()

  // The signed-in user, none while signed out
  return userId ? { id: userId, username: profile.username, email: profile.email } : null
}
