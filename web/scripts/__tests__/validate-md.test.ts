/**
 * Snapshot test for the `validate-md` fixtures. Each fixture is a markdown
 * file under `scripts/__fixtures__/validate-md/`. The test asserts the
 * verdict for `valid-*` (must succeed) and `invalid-*` (must fail), then
 * snapshots a stable summary so future plugin upgrades cannot silently
 * change behaviour without a snapshot diff to review.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

import { validateMarkdown } from '../../src/components/shared/components/rich-math-editor/utils/markdown-pipeline'

/** Absolute directory containing this test file . */
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Absolute directory containing all fixtures. */
const FIXTURES_DIR = path.join(TEST_DIR, '..', '__fixtures__', 'validate-md')

/** Sorted fixture filenames so test order is deterministic. */
const fixtures = fs
  .readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith('.md'))
  .sort()

/**
 * Snapshot entry recorded for a fixture that passed validation. Verdict
 * only — the rendered HTML is intentionally excluded so that trivial
 * plugin-update formatting changes do not produce noisy snapshot diffs.
 */
type OkSnapshot = {
  /** The discriminator */
  verdict: 'ok'
}

/**
 * Snapshot entry recorded for a fixture that failed validation. Captures
 * stage + first line of the error so each failure mode has a distinct,
 * reviewable snapshot.
 */
type FailSnapshot = {
  /** The discriminator */
  verdict: 'fail'
  /** Pipeline stage at which validation failed */
  stage: string
  /** First line of the error message — KaTeX errors can be multi-line, only the headline is locked in */
  errorFirstLine: string
}

/**
 * Shape of one snapshot entry — discriminated union over success and
 * failure cases.
 */
type SnapshotShape = OkSnapshot | FailSnapshot

/**
 * Reduces a {@link ValidationResult} to the minimal shape we lock in via
 * snapshot.
 *
 * @param result - The result returned by `validateMarkdown` for a fixture.
 *
 * @returns A small object suitable for `toMatchSnapshot`.
 */
function summarize(result: Awaited<ReturnType<typeof validateMarkdown>>): SnapshotShape {
  // Success path: verdict only
  if (result.ok) {
    return { verdict: 'ok' }
  }

  // Failure path: take just the headline of the error message
  const errorFirstLine = result.error.split('\n')[0] ?? ''

  // Wrap stage and headline into a fail-shaped entry
  return { verdict: 'fail', stage: result.stage, errorFirstLine }
}

describe('validate-md fixtures', () => {
  // One test case per fixture; failures point at the offending file
  for (const filename of fixtures) {
    it(filename, async () => {
      // Read the fixture content from disk
      const text = fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8')

      // Run the validator
      const result = await validateMarkdown(text)

      // Hard verdict assertions for the binary cases — a regression flips these even if the snapshot is regenerated
      if (filename.startsWith('valid-')) {
        expect(
          result.ok,
          result.ok ? '' : `expected ${filename} to validate, but failed: ${result.error}`
        ).toBe(true)
      } else if (filename.startsWith('invalid-')) {
        expect(
          result.ok,
          result.ok ? `expected ${filename} to fail validation, but it passed` : ''
        ).toBe(false)
      }

      // Snapshot the summarised result regardless of branch above
      expect(summarize(result)).toMatchSnapshot()
    })
  }
})
