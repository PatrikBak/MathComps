/**
 * Draft preflight CLI — the entry point the `draft:preflight` npm script runs.
 * Parses arguments, runs {@link preflightDraft}, prints either the machine
 * manifest (`--json`) or a human report, and exits with a status reflecting the
 * verdict.
 *
 * Run with:
 *   tsx scripts/preflight-draft.ts <draft-folder> [--json]
 *
 * `--json` writes the manifest as JSON to stdout (the machine contract); the
 * default prints a human-readable report. The process exits 0 when the verdict
 * holds and 1 when it carries an error.
 */

import path from 'path'
import { pathToFileURL } from 'url'

import { isOk, preflightDraft } from './preflight-draft-core'
import { asMessage } from './preflight-draft-parse'
import type { DraftManifest, VerdictError } from './preflight-draft-types'

/**
 * Renders one verdict entry as a single human-readable line.
 *
 * @param error - The entry to format.
 *
 * @returns A line prefixed with a severity icon and tagged `file → half (line)`.
 */
function formatVerdictLine(error: VerdictError): string {
  // AI loves emojis
  const icon = error.severity === 'error' ? '❌' : '⚠️ '

  // Optional half / line location tags
  const halfTag = error.half !== null ? ` → ${error.half}` : ''
  const lineTag = error.line !== null ? ` (line ${error.line})` : ''

  // Compose the icon, location tag, message, and rule into one line
  return `  ${icon} ${error.file}${halfTag}${lineTag}: ${error.message} [${error.rule}]`
}

/**
 * Prints a human-readable preflight report to stdout.
 *
 * @param folderPath - The draft folder that was validated.
 * @param manifest - The manifest the run produced.
 */
function printHumanReport(folderPath: string, manifest: DraftManifest): void {
  // Pull the problems and verdict off the manifest
  const { problems, verdict } = manifest

  // Count distinct images across problems
  const imageCount = new Set(problems.flatMap((problem) => problem.images)).size

  // Count total text variants across problems
  const textCount = problems.reduce((sum, problem) => sum + problem.texts.length, 0)

  // Log the folder being checked
  console.log(`🔍 Preflighting draft: ${folderPath}`)

  // Log the problem, text, and image counts
  console.log(
    `   ${problems.length} problem(s), ${textCount} text(s), ${imageCount} image(s) referenced\n`
  )

  // List every issue, or confirm a clean run
  if (verdict.errors.length === 0) {
    console.log('  ✅ no issues')
  } else {
    for (const error of verdict.errors) {
      console.log(formatVerdictLine(error))
    }
  }

  // Close with the headline verdict and counts
  const errorCount = verdict.errors.filter((error) => error.severity === 'error').length
  const warningCount = verdict.errors.length - errorCount
  if (isOk(verdict.errors)) {
    const suffix = warningCount > 0 ? ` (${warningCount} warning(s))` : ''
    console.log(`\n✅ Preflight passed${suffix}`)
  } else {
    console.log(`\n❌ Preflight failed — ${errorCount} error(s), ${warningCount} warning(s)`)
  }
}

/**
 * Parses arguments, runs the preflight, prints the requested output, and exits
 * with a status reflecting the verdict.
 *
 * @param argv - CLI arguments after the script name.
 */
async function runCli(argv: string[]): Promise<void> {
  // Outputting JSON?
  const jsonMode = argv.includes('--json')

  // Which draft folder?
  const folderArg = argv.find((arg) => !arg.startsWith('--'))

  // The draft folder is the one required argument
  if (folderArg === undefined) {
    console.error('Usage: tsx scripts/preflight-draft.ts <draft-folder> [--json]')
    process.exit(1)
  }

  // Resolve to an absolute path
  const folderPath = path.resolve(folderArg)

  // Run the preflight
  const manifest = await preflightDraft(folderPath)

  // Success iff no errors
  const exitCode = isOk(manifest.verdict.errors) ? 0 : 1

  // --json emits only the contract so a caller can parse stdout directly. When stdout is a pipe (a parent
  // process capturing it, not a terminal), a large manifest is written asynchronously — exiting before it
  // drains would truncate it, so wait for the write to flush before exiting.
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`, () => process.exit(exitCode))
    return
  } else {
    // No --json: a human is reading this, so print the formatted report
    printHumanReport(folderPath, manifest)
    process.exit(exitCode)
  }
}

// Run the CLI only when this file is the process entry point, never on import (e.g. from tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(asMessage(error))
    process.exit(1)
  })
}
