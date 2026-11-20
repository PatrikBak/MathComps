import { CHUNK_LOAD_RELOAD_STORAGE_KEY } from '@/constants/local-storage-constants'

import { MINUTE_MS } from './time-units'

/**
 * How long after a reload another failure on a page of the same deployment means the reload did not help.
 * Long enough for a visitor to try the same thing again. Past it, a failure there is a new one, as after a
 * deploy that took the deployment's files, and gets a reload of its own.
 */
const RELOAD_WINDOW_MS = 10 * MINUTE_MS

/**
 * A tab's record of the page's last reload over a chunk that failed to load.
 */
type ReloadRecord = {
  /** The deployment that served the page that reloaded */
  deployment: string

  /** When it reloaded, in milliseconds since the epoch */
  reloadedAt: number
}

/**
 * The deployment that served this page, or empty for a build that names none, such as a local one.
 *
 * @returns The deployment's id.
 */
function pageDeployment(): string {
  // Read on every call, since Next.js sets it in the browser only as the page starts
  return process.env.NEXT_DEPLOYMENT_ID || ''
}

/**
 * Whether the page should reload itself over a fault: a chunk that failed to load, which a page kept open
 * past a deploy raises once that deploy's files are gone. The reload brings the current deployment's page,
 * so it is due unless a page of this same deployment reloaded within RELOAD_WINDOW_MS, or the tab cannot
 * read its storage to tell.
 *
 * @param error - The fault the page hit.
 *
 * @returns Whether to reload.
 */
export function shouldReloadFor(error: unknown): boolean {
  // A fresh page cures only a chunk that never arrived, which the bundler's runtime names ChunkLoadError
  if (!(error instanceof Error && error.name === 'ChunkLoadError')) return false

  try {
    // The tab's record of the last reload
    const stored = sessionStorage.getItem(CHUNK_LOAD_RELOAD_STORAGE_KEY)

    // Due in a tab that never reloaded
    if (stored === null) return true

    // The record, as the reloading page wrote it
    const record = JSON.parse(stored) as ReloadRecord

    // Due unless a page of this deployment reloaded within the window, since that reload did not help
    return (
      record.deployment !== pageDeployment() || Date.now() - record.reloadedAt >= RELOAD_WINDOW_MS
    )
  } catch {
    // A tab that cannot read its record cannot tell a second reload from a first, so it never reloads
    return false
  }
}

/**
 * Records in the tab's storage that a page of this deployment is reloading itself over a chunk that failed
 * to load, which {@link shouldReloadFor} reads on the reloaded page.
 *
 * @returns Whether the record was kept, without which the page must not reload.
 */
export function recordChunkLoadReload(): boolean {
  // The deployment that served the page now reloading, and when
  const record: ReloadRecord = { deployment: pageDeployment(), reloadedAt: Date.now() }

  try {
    // The record, kept for the reloaded page
    sessionStorage.setItem(CHUNK_LOAD_RELOAD_STORAGE_KEY, JSON.stringify(record))

    // Kept
    return true
  } catch {
    // A full or blocked storage keeps nothing
    return false
  }
}
