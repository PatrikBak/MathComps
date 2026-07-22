import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * Builds the API URL for the admin identity probe that echoes the caller's
 * admin identity, used to observe whether the admin policy passed.
 *
 * @returns The API URL path for the admin whoami endpoint
 */
export function getAdminWhoamiUrl(): string {
  return buildApiUrl('/admin/whoami')
}
