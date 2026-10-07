import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path the selection's endpoints hang off.
 */
const SELECTION_PATH = '/problem-selection'

/**
 * Builds the API URL for reading the whole selection.
 *
 * @returns The API URL.
 */
export function getSelectionUrl(): string {
  // The selection's own endpoint
  return buildApiUrl(SELECTION_PATH)
}
