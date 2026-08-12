import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The path for the AI-consent endpoints.
 */
const AI_CONSENT_PATH = '/users/me/ai-consent'

/**
 * Builds the URL for reading and recording the user's acknowledgement of what talking to Mathilda entails.
 *
 * @returns The consent URL.
 */
export function getMathildaConsentUrl(): string {
  // The consent endpoint, read with GET and written with POST
  return buildApiUrl(AI_CONSENT_PATH)
}
