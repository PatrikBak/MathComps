/**
 * Builds the defense-content blobs the AI examiner is served from: one file per handout per language,
 * mapping each defendable environment's permanent id to the statement, reference and hints the examiner
 * is given. They exist so the backend can look a problem up from a `(handout, environment)` target
 * instead of trusting a caller to supply the text, which is what stops a signed-in student feeding
 * arbitrary prose to the model.
 *
 * The blobs are derived from the committed handout content and nothing in the site reads them, so they
 * are build output rather than a committed artifact and land next to the compiled PDFs. Output must be
 * byte-stable for identical input: the upload ledger skips a blob whose bytes are unchanged, so a
 * gratuitously different serialization would re-push every handout on every build.
 */

import fs from 'fs'
import path from 'path'

import type { Document } from '../src/components/features/handouts/handout-content-types'
import {
  type DefenseContent,
  toDefenseContent,
} from '../src/components/features/handouts/handout-defense-content'
import {
  getContentFileBasename,
  type HandoutIndex,
  type HandoutMetadata,
  supportsLocale,
} from '../src/components/features/handouts/handout-metadata-types'
import { listDocumentEnvironments } from '../src/components/features/handouts/handout-utils'
import { type Locale, SUPPORTED_LOCALES } from '../src/i18n/i18n'

/** Directory containing handout content files. */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/handouts')

/** Path to `handouts.json`. */
const INDEX_PATH = path.join(CONTENT_DIR, '../handouts.json')

/** Directory the generated blobs are written to, alongside the other build output of a handout. */
const DEFENSE_CONTENT_DIR = path.join(process.cwd(), '../data/handouts/defense')

/** One handout variant's defendable environments, keyed by permanent environment id. */
type HandoutDefenseContent = Record<string, DefenseContent>

/** One generated blob, under the name it is stored and uploaded as. */
export type DefenseContentBlob = {
  /** The file name, `<handout content id>.<locale>.json`. */
  fileName: string
  /** The variant's defendable environments. */
  content: HandoutDefenseContent
}

/**
 * Reads one language variant of a handout and collects every environment that can be defended, in
 * document order.
 *
 * @param handout - The handout the variant belongs to.
 * @param locale - The variant to read.
 * @param contentDir - The directory content files are read from.
 *
 * @returns The variant's defendable environments, or null when it has no content file yet.
 */
function collectVariantDefenseContent(
  handout: HandoutMetadata,
  locale: Locale,
  contentDir: string = CONTENT_DIR
): HandoutDefenseContent | null {
  // The content file's path
  const contentPath = path.join(contentDir, `${getContentFileBasename(handout)}.${locale}.json`)

  // A variant with no content file yet has nothing to collect; the content validator already reports
  // the missing file, so this just yields nothing rather than duplicating that error
  if (!fs.existsSync(contentPath)) {
    return null
  }

  // The variant's document
  const { document }: { document: Document } = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))

  // Every environment paired with what the examiner would be told about it, minus the ones hiding nothing
  const defendable = listDocumentEnvironments(document).flatMap((environment) => {
    // What the examiner would be given for this environment
    const content = toDefenseContent(environment.block)

    // An environment with nothing to defend contributes no entry
    return content === null ? [] : [[environment.block.id, content] as const]
  })

  // Keyed by permanent id, in document order so the serialization is stable across runs
  return Object.fromEntries(defendable)
}

/**
 * Collects a blob for every published variant of every handout, walking `handouts.json` rather than
 * globbing content files, so a stray or unpublished file never bleeds into the output.
 *
 * @param indexPath - The handout index to read; overridable so tests can point at a fixture index.
 * @param contentDir - The directory content files are read from; overridable for the same reason.
 *
 * @returns One blob per variant that has content on disk, in index order.
 */
export function collectAllDefenseContentBlobs(
  indexPath: string = INDEX_PATH,
  contentDir: string = CONTENT_DIR
): DefenseContentBlob[] {
  // The index of every handout on the site
  const { sections }: HandoutIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  // Every handout, in index order
  const handouts = sections.flatMap((section) => section.handouts)

  // Each handout crossed with the locales it publishes in, keyed by content id rather than file name so
  // the backend can address a blob straight from a defense target
  return handouts.flatMap((handout) =>
    SUPPORTED_LOCALES.filter((locale) => supportsLocale(handout, locale)).flatMap((locale) => {
      // What this variant offers to defend
      const content = collectVariantDefenseContent(handout, locale, contentDir)

      // A variant without a content file contributes no blob at all
      return content === null ? [] : [{ fileName: `${handout.id}.${locale}.json`, content }]
    })
  )
}

/**
 * Serializes one blob. Two-space indentation and a trailing newline, matching the repo's other JSON,
 * with keys emitted in document order so identical content serializes to identical bytes.
 *
 * @param content - The variant's defendable environments.
 *
 * @returns The file's contents.
 */
function serializeDefenseContent(content: HandoutDefenseContent): string {
  // Pretty-printed so a blob stays readable when debugging what the examiner was actually given
  return `${JSON.stringify(content, null, 2)}\n`
}

/**
 * Writes the blobs to the output directory, replacing whatever was there. Files left over from a handout
 * or language that no longer exists are removed, so a stale blob is never re-uploaded.
 *
 * @param blobs - The blobs to write.
 * @param outputDir - The directory to write them to.
 */
export function writeDefenseContentBlobs(
  blobs: DefenseContentBlob[],
  outputDir: string = DEFENSE_CONTENT_DIR
): void {
  // The directory may not exist on a fresh checkout, since it holds nothing committed
  fs.mkdirSync(outputDir, { recursive: true })

  // What this run produces, to tell a current blob from a leftover
  const written = new Set(blobs.map((blob) => blob.fileName))

  // Drop leftovers first, so the directory only ever describes the current content
  fs.readdirSync(outputDir)
    .filter((fileName) => !written.has(fileName))
    .forEach((fileName) => fs.rmSync(path.join(outputDir, fileName)))

  // Write each blob
  blobs.forEach((blob) =>
    fs.writeFileSync(path.join(outputDir, blob.fileName), serializeDefenseContent(blob.content))
  )
}
