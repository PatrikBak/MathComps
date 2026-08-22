import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { UserProfile } from '../model/profile-types'
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
