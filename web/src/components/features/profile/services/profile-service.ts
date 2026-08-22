import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { UserCompetitionProfile, UserProfile } from '../model/profile-types'
import { getSetUsernameUrl, getUserProfileUrl } from './profile-api-urls'

/**
 * Reads what the site holds on the signed-in user.
 *
 * @param apiCall - The caller carrying the signed-in user's token
 *
 * @returns Their profile, or the failure that stopped it being read.
 */
export function getUserProfile(apiCall: ApiCaller): Promise<ApiResult<UserProfile>> {
  return apiCall<UserProfile>(() => getUserProfileUrl(), { method: 'GET' })
}

/**
 * Takes a username for the signed-in user, which cannot be undone.
 *
 * @param apiCall - The caller carrying the signed-in user's token
 * @param username - The name to take
 *
 * @returns Nothing, or the failure that stopped the name being taken.
 */
export function setUsername(apiCall: ApiCaller, username: string): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSetUsernameUrl(), {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

/**
 * Replaces what the signed-in user has said about their competing.
 *
 * @param apiCall - The caller carrying the signed-in user's token
 * @param profile - What they are saying about themselves now
 *
 * @returns Nothing, or the failure that stopped it being saved.
 */
export function updateUserProfile(
  apiCall: ApiCaller,
  profile: UserCompetitionProfile
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getUserProfileUrl(), {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}
