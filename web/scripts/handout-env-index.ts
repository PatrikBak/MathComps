/**
 * Builds the generated `handout-env-index.json`: every handout environment on the site, keyed by its handout's
 * content id and then by its own permanent id, carrying its type and the document-wide number the page displays
 * for it. Numbers come from {@link listDocumentEnvironments}, the same function {@link HandoutDetail} renders
 * with, so the index can never disagree with the page about what "Úloha 4" means.
 */

import fs from 'fs'
import path from 'path'

import type {
  Document,
  HandoutEnvironmentType,
} from '../src/components/features/handouts/handout-content-types'
import {
  getContentFileBasename,
  type HandoutEnvIndex,
  type HandoutIndex,
  type HandoutMetadata,
} from '../src/components/features/handouts/handout-metadata-types'
import { listDocumentEnvironments } from '../src/components/features/handouts/handout-utils'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '../src/i18n/i18n'

/** Directory containing handout content files. */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/handouts')

/** Path to `handouts.json`. */
const INDEX_PATH = path.join(CONTENT_DIR, '../handouts.json')

/** Path the generated index is written to and read back from. */
export const ENV_INDEX_PATH = path.join(CONTENT_DIR, '../handout-env-index.json')

/** One environment as collected from a content file, with the handout it came from. */
export type CollectedEnvironment = {
  /** The handout's permanent content id. */
  handoutContentId: string
  /** The environment's permanent id. */
  environmentId: string
  /** The environment's type. */
  environmentType: HandoutEnvironmentType
  /** The document-wide, per-type number the page displays for it. */
  environmentNumber: number
  /** The content file this environment was read from, for tracing an entry back to its source on disk. */
  source: string
}

/**
 * Picks the locale a handout's environments are numbered from: the default locale when the handout supports it,
 * else its first declared language. The choice is well-defined precisely because {@link validateHandoutEnvironmentIds}
 * refuses a handout whose variants disagree on their environment sequence — given that invariant, every variant
 * numbers its environments identically.
 *
 * @param handout - The handout to pick a canonical locale for.
 *
 * @returns The locale to read the handout's environments from.
 */
function canonicalLocale(handout: HandoutMetadata): Locale {
  // The declared languages, or every supported locale when none are declared
  const locales = handout.languages ?? SUPPORTED_LOCALES

  // Prefer the default locale when this handout has it, else fall back to whichever it declares first
  const locale = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0]

  // A handout that declares an empty language list has no variant to number from at all
  if (locale === undefined) {
    throw new Error(
      `Handout "${handout.id}" declares an empty languages list; omit the field to support every locale.`
    )
  }

  // The variant to read
  return locale
}

/**
 * Reads one content file and lists its environments, numbered the way the page numbers them.
 *
 * @param handout - The handout the content file belongs to.
 * @param contentDir - The directory content files are read from; overridable so tests can point at a fixture
 *   directory instead of the site's real content.
 *
 * @returns One entry per environment in the handout's canonical variant, in document order.
 */
export function collectHandoutEnvironments(
  handout: HandoutMetadata,
  contentDir: string = CONTENT_DIR
): CollectedEnvironment[] {
  // The variant every environment number is read from
  const locale = canonicalLocale(handout)

  // The content file's name and path
  const contentFile = `${getContentFileBasename(handout)}.${locale}.json`
  const contentPath = path.join(contentDir, contentFile)

  // A handout entry with no content file yet has nothing to collect; the content validator already reports
  // the missing file, so this just yields nothing rather than duplicating that error.
  if (!fs.existsSync(contentPath)) {
    return []
  }

  // Read the canonical variant's document
  const { document }: { document: Document } = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))

  // List its environments and pair each with the handout it belongs to
  return listDocumentEnvironments(document).map((environment) => ({
    handoutContentId: handout.id,
    environmentId: environment.block.id,
    environmentType: environment.block.type,
    environmentNumber: environment.number,
    source: contentFile,
  }))
}

/**
 * Collects every handout environment on the site, walking `handouts.json` rather than globbing content
 * files, so a stray or unpublished file never bleeds into the index.
 *
 * @param indexPath - The handout index to read; overridable so tests can point at a fixture index.
 * @param contentDir - The directory content files are read from; overridable for the same reason.
 *
 * @returns Every environment found, across every handout.
 */
export function collectAllHandoutEnvironments(
  indexPath: string = INDEX_PATH,
  contentDir: string = CONTENT_DIR
): CollectedEnvironment[] {
  // The index of every handout on the site
  const { sections }: HandoutIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  // Every handout's environments, in index order
  return sections.flatMap((section) =>
    section.handouts.flatMap((handout) => collectHandoutEnvironments(handout, contentDir))
  )
}

/**
 * Collapses a flat list of collected environments into the shipped index shape. Callers that need to detect
 * duplicate ids should do so over the flat list first — this collapse is lossy by construction (last write wins).
 *
 * @param entries - The environments to index.
 *
 * @returns The environments keyed by handout content id, then by environment id.
 */
export function toHandoutEnvIndex(entries: CollectedEnvironment[]): HandoutEnvIndex {
  // Built up handout by handout, environment by environment
  const index: HandoutEnvIndex = {}

  // Fold every entry into its handout's bucket
  for (const entry of entries) {
    // Start this handout's bucket the first time one of its environments is seen
    index[entry.handoutContentId] ??= {}

    // Record this environment's placement
    index[entry.handoutContentId][entry.environmentId] = {
      type: entry.environmentType,
      number: entry.environmentNumber,
    }
  }

  // The completed index
  return index
}
