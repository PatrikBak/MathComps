/**
 * Shared runtime for the content validators: the orphan-file scan and the announce/print/exit
 * harness. The pure, environment-agnostic field checks live in
 * `src/lib/content-validation.ts`; this module owns the filesystem + process concerns the CLI scripts
 * share.
 */

import fs from 'fs'

import { SUPPORTED_LOCALES } from '../src/i18n/i18n'

/**
 * Run/success/failure wording for one content validator.
 */
type ValidatorMessages = {
  /** The content type being validated, e.g. `news translations`. */
  validating: string
  /** Success message for a clean run. */
  success: string
  /** Failure message when errors are found. */
  failure: string
}

/**
 * Finds locale-suffixed content files on disk that no index entry accounts for. Matches files named
 * `<slug>.<locale>.<extension>` and flags any that the expected set doesn't contain.
 *
 * @param contentDir - Directory holding the locale-suffixed content files.
 * @param extension - The content file extension without the dot, e.g. `mdx` or `json`.
 * @param expectedFiles - The filenames the index expects to exist.
 * @param indexName - The index filename, named in the error message (e.g. `news.json`).
 *
 * @yields An error for each orphan file.
 */
export function* validateNoOrphans(
  contentDir: string,
  extension: string,
  expectedFiles: ReadonlySet<string>,
  indexName: string
): Generator<string> {
  // Read the locale-suffixed content files present on disk
  const contentFiles = fs
    .readdirSync(contentDir)
    .filter((file) =>
      new RegExp(`^.+\\.(${SUPPORTED_LOCALES.join('|')})\\.${extension}$`).test(file)
    )

  // Flag any file the index doesn't reference
  for (const file of contentFiles) {
    if (!expectedFiles.has(file)) {
      yield `⚠️  Orphan content file not referenced in ${indexName}: ${file}`
    }
  }
}

/**
 * Runs a content validator: announces the run, prints every collected error, and exits the process
 * with status 0 (valid) or 1 (failed).
 *
 * @param messages - The run/success/failure wording for this content type.
 * @param validate - Collects and returns every validation error (empty when valid).
 *
 * @returns Never — always exits the process.
 */
export function runValidator(messages: ValidatorMessages, validate: () => string[]): never {
  // Announce the run
  console.log(`🔍 Validating ${messages.validating}...\n`)

  // Collect the errors
  const errors = validate()
  // Print each one
  for (const error of errors) {
    console.error(error)
  }

  // No errors → success
  if (errors.length === 0) {
    // Print the success line
    console.log(`✅ ${messages.success}`)
    // Exit clean
    process.exit(0)
  }

  // Print the failure banner
  console.log(`\n⚠️  ${messages.failure}`)
  // Exit non-zero
  process.exit(1)
}
