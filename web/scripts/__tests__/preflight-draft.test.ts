/**
 * Tests for the draft preflight. Two layers:
 *
 * 1. Integration tests that run {@link preflightDraft} against real on-disk
 *    draft folders under `scripts/__fixtures__/preflight-draft/`, asserting the
 *    verdict (by `valid-`/`invalid-` prefix), the parsed manifest content, and
 *    the specific issue each broken fixture should surface.
 * 2. Unit tests over the exported pure helpers, with inline inputs and no disk.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

import { isOk, preflightDraft } from '../preflight-draft-core'
import { narrowMeta } from '../preflight-draft-meta'
import {
  collectImageNames,
  hasLeadingFrontmatter,
  parseProblemMeta,
  splitOnSentinel,
  toAbsoluteLine,
} from '../preflight-draft-parse'
import type { DraftManifest, VerdictError } from '../preflight-draft-types'

/** Absolute directory containing this test file. */
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Absolute directory containing every draft fixture folder. */
const FIXTURES_DIR = path.join(TEST_DIR, '..', '__fixtures__', 'preflight-draft')

/** Sorted fixture folder names so test order is deterministic. */
const caseDirs = fs
  .readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

/** The minimal, version-stable shape of one verdict entry locked into a snapshot. */
type ErrorSummary = Pick<VerdictError, 'file' | 'half' | 'rule' | 'severity'>

/** A compact, deterministic summary of a manifest for snapshotting. */
type ManifestSummary = {
  /** The aggregate verdict. */
  ok: boolean
  /** Number of problems parsed. */
  problemCount: number
  /** The problems' orders, in manifest order. */
  problemOrders: number[]
  /** Each problem's text languages, original first, in manifest order. */
  problemLanguages: string[][]
  /** Every issue reduced to its stable fields (message and position omitted). */
  errors: ErrorSummary[]
}

/**
 * Reduces a manifest to a small, version-stable shape. Error messages and line
 * numbers are dropped so a KaTeX upgrade cannot churn the snapshots; they are
 * checked in the targeted assertions instead.
 *
 * @param manifest - The manifest a fixture produced.
 *
 * @returns The compact summary to snapshot.
 */
function summarize(manifest: DraftManifest): ManifestSummary {
  return {
    ok: isOk(manifest.verdict.errors),
    problemCount: manifest.problems.length,
    problemOrders: manifest.problems.map((problem) => problem.order),
    problemLanguages: manifest.problems.map((problem) =>
      problem.texts.map((text) => text.language)
    ),
    errors: manifest.verdict.errors.map((error) => ({
      file: error.file,
      half: error.half,
      rule: error.rule,
      severity: error.severity,
    })),
  }
}

/**
 * Runs the preflight against a named fixture folder.
 *
 * @param name - The fixture folder name under the fixtures directory.
 *
 * @returns The manifest the preflight produced.
 */
function loadFixture(name: string): Promise<DraftManifest> {
  return preflightDraft(path.join(FIXTURES_DIR, name))
}

/**
 * Finds the first verdict entry matching a predicate.
 *
 * @param manifest - The manifest to search.
 * @param predicate - The match condition.
 *
 * @returns The first matching entry, or `undefined` when none match.
 */
function findError(
  manifest: DraftManifest,
  predicate: (error: VerdictError) => boolean
): VerdictError | undefined {
  return manifest.verdict.errors.find(predicate)
}

describe('preflight-draft fixtures (verdict + snapshot)', () => {
  // One case per fixture folder; the prefix encodes the expected verdict
  for (const caseName of caseDirs) {
    it(caseName, async () => {
      const manifest = await loadFixture(caseName)

      // Hard verdict assertion — a regression flips this even if the snapshot is regenerated
      if (caseName.startsWith('valid-')) {
        expect(
          isOk(manifest.verdict.errors),
          `expected ${caseName} to pass, got: ${JSON.stringify(manifest.verdict.errors)}`
        ).toBe(true)
      } else if (caseName.startsWith('invalid-')) {
        expect(isOk(manifest.verdict.errors), `expected ${caseName} to fail, but it passed`).toBe(
          false
        )
      }

      // Snapshot the stable summary regardless of branch above
      expect(summarize(manifest)).toMatchSnapshot()
    })
  }
})

describe('valid drafts — parsed manifest content', () => {
  it('parses meta, the original text, authors, and image refs', async () => {
    const manifest = await loadFixture('valid-basic')

    // Two problems, ordered by filename
    expect(manifest.problems.map((problem) => problem.order)).toEqual([1, 2])

    // Each problem has a single Slovak original text variant
    const [first, second] = manifest.problems
    const firstOriginal = first!.texts[0]!
    expect(first!.texts).toHaveLength(1)
    expect(firstOriginal.language).toBe('sk')
    expect(firstOriginal.original).toBe(true)

    // The first problem has a solution; the second (no sentinel) does not
    expect(firstOriginal.solutionMarkdown).not.toBeNull()
    expect(second!.texts[0]!.solutionMarkdown).toBeNull()

    // Author names survive parsing, including diacritics
    expect(first!.authors).toEqual(['Jaromír Šimša'])

    // Image references are reduced to basenames and the body still carries the relative ref for C#
    expect(first!.images).toEqual(['incircle.svg'])
    expect(firstOriginal.statementMarkdown).toContain('images/incircle.svg')

    // Taxonomy is carried through verbatim
    expect(manifest.meta.competition).toBe('csmo')
    expect(manifest.meta.category).toBe('a')
    expect(manifest.meta.round).toBe('iii')
    expect(manifest.meta.season).toEqual({ year: 2024 })
    expect(manifest.meta.date).toBe('2024-03-15')
    expect(manifest.meta.language).toBe('sk')

    // A clean run carries no issues at all
    expect(isOk(manifest.verdict.errors)).toBe(true)
    expect(manifest.verdict.errors).toEqual([])
  })

  it('treats an absent category as null', async () => {
    const manifest = await loadFixture('valid-no-category')
    expect(manifest.meta.category).toBeNull()
    expect(manifest.meta.competition).toBe('imo')
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('assembles every language variant with the original first', async () => {
    const manifest = await loadFixture('valid-multilang')
    const [problem] = manifest.problems

    // The original (sk) sorts ahead of the translations, which follow in supported-locale order
    expect(problem!.texts.map((text) => text.language)).toEqual(['sk', 'cs', 'en'])
    expect(problem!.texts[0]!.original).toBe(true)
    expect(problem!.texts.filter((text) => text.original)).toHaveLength(1)
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('lets a translation carry just the statement', async () => {
    const manifest = await loadFixture('valid-translation-statement-only')
    const translation = manifest.problems[0]!.texts.find((text) => text.language === 'en')!
    expect(translation.solutionMarkdown).toBeNull()
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('accepts a translation-only drop with no original body', async () => {
    const manifest = await loadFixture('valid-translation-only')
    const [problem] = manifest.problems

    // The draft's language is sk but only cs/en bodies are present, so every variant is a translation
    expect(problem!.texts.map((text) => text.language)).toEqual(['cs', 'en'])
    expect(problem!.texts.some((text) => text.original)).toBe(false)

    // Omitting the original passes the format gate; whether the target exists is the DB-aware validate step's call
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('accepts a translation-only subset with non-contiguous orders and no pN.yaml', async () => {
    const manifest = await loadFixture('valid-translation-only-subset')

    // The fixed problems sit at orders 2 and 5; the gap is preserved, not renumbered down to 1, 2
    expect(manifest.problems.map((problem) => problem.order)).toEqual([2, 5])

    // Every variant is a translation — no body is in the draft's original (sk) language
    expect(manifest.problems.every((problem) => !problem.texts.some((text) => text.original))).toBe(
      true
    )

    // pN.yaml is omitted, so authors/tags default to null (left untouched on apply)
    expect(
      manifest.problems.every((problem) => problem.authors === null && problem.tags === null)
    ).toBe(true)

    // The preflight checks format only; contiguity and pN.yaml presence are the DB-aware validate step's call, so a
    // bare subset of orders passes the format gate cleanly
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('accepts a non-contiguous subset that carries originals', async () => {
    const manifest = await loadFixture('valid-subset-with-originals')

    // Problems sit at orders 1 and 3 (no order 2); the preflight leaves the gap for the DB-aware validate step to
    // judge against what already exists
    expect(manifest.problems.map((problem) => problem.order)).toEqual([1, 3])

    // Unlike a translation-only drop, these carry their original-language body — yet the format gate still passes
    expect(manifest.problems.every((problem) => problem.texts.some((text) => text.original))).toBe(
      true
    )
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('accepts a problem with bodies but no pN.yaml sidecar', async () => {
    const manifest = await loadFixture('valid-no-problem-meta')
    const [problem] = manifest.problems

    // No pN.yaml, so hasSidecar is false and authors/tags stay null; whether a fresh problem may omit it is the
    // DB-aware validate step's call, not the preflight's
    expect(problem!.hasSidecar).toBe(false)
    expect(problem!.authors).toBeNull()
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('unions a shared image across languages without an orphan warning', async () => {
    const manifest = await loadFixture('valid-shared-image-across-langs')
    expect(manifest.problems[0]!.images).toEqual(['fig.svg'])
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('preserves multiple authors in order', async () => {
    const manifest = await loadFixture('valid-multi-author')
    expect(manifest.problems[0]!.authors).toEqual(['First Author', 'Second Author'])
  })

  it('reads an optional solution link', async () => {
    const manifest = await loadFixture('valid-solution-link')
    expect(manifest.problems[0]!.solutionLink).toBe('https://example.com/solution')
  })

  it('leaves external image references untouched', async () => {
    const manifest = await loadFixture('valid-external-image')
    expect(manifest.problems[0]!.images).toEqual([])
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('resolves an image whose ref carries query params', async () => {
    const manifest = await loadFixture('valid-image-params')
    expect(manifest.problems[0]!.images).toEqual(['fig.svg'])
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('warns on an orphan image without failing the run', async () => {
    const manifest = await loadFixture('valid-orphan-warns')
    const orphan = findError(manifest, (error) => error.rule === 'orphan-image')
    expect(orphan?.severity).toBe('warning')
    expect(orphan?.file).toBe('images/extra.svg')
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('collects an image referenced only in the solution half', async () => {
    const manifest = await loadFixture('valid-solution-image')
    expect(manifest.problems[0]!.images).toEqual(['diagram.svg'])
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('accepts a raster (PNG) figure', async () => {
    const manifest = await loadFixture('valid-raster-image')
    expect(manifest.problems[0]!.images).toEqual(['fig.png'])
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('leaves authors null when a problem declares none', async () => {
    const manifest = await loadFixture('valid-minimal-meta')
    expect(manifest.problems[0]!.authors).toBeNull()
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })
})

describe('invalid drafts — specific issues', () => {
  it('flags a missing image file', async () => {
    const manifest = await loadFixture('invalid-missing-image')
    const error = findError(manifest, (entry) => entry.rule === 'missing-image')
    expect(error?.severity).toBe('error')
    expect(error?.message).toContain('missing.svg')
  })

  it('flags an unsupported image format', async () => {
    const manifest = await loadFixture('invalid-unsupported-image')
    const error = findError(manifest, (entry) => entry.rule === 'unsupported-image-format')
    expect(error?.severity).toBe('error')
    expect(error?.message).toContain('diagram.gif')
  })

  it('flags an oversized image', async () => {
    // A throwaway draft dir, cleaned up in the finally — keeps a multi-megabyte blob out of the committed fixtures.
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-oversized-'))
    try {
      // Seed it from the raster fixture.
      fs.cpSync(path.join(FIXTURES_DIR, 'valid-raster-image'), tempDir, { recursive: true })

      // Bloat the figure just past the 2 MB cap; statSync reads only the size, so zero bytes (not a real PNG) suffice.
      fs.writeFileSync(path.join(tempDir, 'images', 'fig.png'), Buffer.alloc(2 * 1024 * 1024 + 1))

      // Run the preflight over the bloated draft.
      const manifest = await preflightDraft(tempDir)

      // The oversized figure is flagged as a blocking error, attributed to the file.
      const error = findError(manifest, (entry) => entry.rule === 'oversized-image')
      expect(error?.severity).toBe('error')
      expect(error?.message).toContain('fig.png')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('flags two images that share a stem', async () => {
    const manifest = await loadFixture('invalid-image-stem-collision')
    const error = findError(manifest, (entry) => entry.rule === 'image-stem-collision')
    expect(error?.severity).toBe('error')
    expect(error?.message).toContain('fig.svg')
    expect(error?.message).toContain('fig.png')
  })

  it('flags broken math in the statement half', async () => {
    const manifest = await loadFixture('invalid-bad-katex-statement')
    const error = findError(manifest, (entry) => entry.rule === 'katex')
    expect(error?.half).toBe('statement')
  })

  it('flags broken math in the solution half', async () => {
    const manifest = await loadFixture('invalid-bad-katex-solution')
    const error = findError(manifest, (entry) => entry.rule === 'katex')
    expect(error?.half).toBe('solution')
  })

  it('flags broken math in a translation, tagged to its body file', async () => {
    const manifest = await loadFixture('invalid-translation-bad-katex')
    const error = findError(manifest, (entry) => entry.rule === 'katex')
    expect(error?.file).toBe('p1.en.md')
    expect(error?.half).toBe('statement')
  })

  it('accepts a draft with no round as a default-round competition (round is null)', async () => {
    const manifest = await loadFixture('valid-default-round')

    // A missing round is the default round (e.g. IMO), not a meta error, and is carried through as null.
    expect(findError(manifest, (entry) => entry.rule === 'meta')).toBeUndefined()
    expect(manifest.meta.round).toBeNull()
    expect(isOk(manifest.verdict.errors)).toBe(true)
  })

  it('flags an unsupported language slug', async () => {
    const manifest = await loadFixture('invalid-bad-language')
    const error = findError(manifest, (entry) => entry.rule === 'meta')
    expect(error?.message).toContain('language')
  })

  it('flags malformed meta YAML without throwing', async () => {
    const manifest = await loadFixture('invalid-malformed-meta')
    const error = findError(manifest, (entry) => entry.rule === 'meta')
    expect(error?.message).toContain('valid YAML')
  })

  it('flags a missing meta file', async () => {
    const manifest = await loadFixture('invalid-missing-meta-file')
    const error = findError(manifest, (entry) => entry.rule === 'meta')
    expect(error?.message).toContain('not found')
  })

  it('flags malformed problem metadata shape without throwing', async () => {
    const manifest = await loadFixture('invalid-bad-problem-meta')
    const error = findError(manifest, (entry) => entry.rule === 'problem-meta')
    expect(error?.file).toBe('p1.yaml')
    expect(error?.message).toContain('authors')
  })

  it('flags malformed problem metadata YAML without throwing', async () => {
    const manifest = await loadFixture('invalid-malformed-problem-meta')
    const error = findError(manifest, (entry) => entry.rule === 'problem-meta')
    expect(error?.message).toContain('valid YAML')
  })

  it('flags a problem with a metadata file but no body', async () => {
    const manifest = await loadFixture('invalid-missing-body')
    const error = findError(manifest, (entry) => entry.rule === 'missing-body')
    expect(error?.message).toContain('body')
  })

  it('flags a body file with an unsupported language token', async () => {
    const manifest = await loadFixture('invalid-unknown-lang')
    const error = findError(manifest, (entry) => entry.rule === 'unknown-lang')
    expect(error?.file).toBe('p1.de.md')
    expect(error?.message).toContain('de')
  })

  it('flags a body that carries frontmatter', async () => {
    const manifest = await loadFixture('invalid-body-frontmatter')
    const error = findError(manifest, (entry) => entry.rule === 'body-frontmatter')
    expect(error?.file).toBe('p1.sk.md')
  })

  it('flags a translated solution with no original solution', async () => {
    const manifest = await loadFixture('invalid-translation-solution-without-original')
    const error = findError(
      manifest,
      (entry) => entry.rule === 'translation-solution-without-original'
    )
    expect(error?.half).toBe('solution')
  })

  it('flags an empty statement', async () => {
    const manifest = await loadFixture('invalid-empty-statement')
    const error = findError(manifest, (entry) => entry.rule === 'empty-statement')
    expect(error?.half).toBe('statement')
  })

  it('flags duplicate problem numbers', async () => {
    const manifest = await loadFixture('invalid-duplicate-order')
    const error = findError(manifest, (entry) => entry.message.includes('duplicate'))
    expect(error?.rule).toBe('problem-files')
  })

  it('flags a folder with no problems', async () => {
    const manifest = await loadFixture('invalid-no-problems')
    const error = findError(manifest, (entry) => entry.rule === 'problem-files')
    expect(error?.message).toContain('no problem files')
  })

  it('flags a problem numbered below 1', async () => {
    const manifest = await loadFixture('invalid-zero-order')
    const error = findError(manifest, (entry) => entry.rule === 'problem-files')
    expect(error?.message).toContain('≥ 1')
  })
})

describe('isOk', () => {
  it('passes when there are no issues', () => {
    expect(isOk([])).toBe(true)
  })

  it('fails when any issue has error severity', () => {
    const errors: VerdictError[] = [
      {
        file: 'p1.sk.md',
        half: null,
        line: null,
        col: null,
        rule: 'katex',
        message: '',
        severity: 'error',
      },
    ]
    expect(isOk(errors)).toBe(false)
  })

  it('passes when the only issues are warnings', () => {
    const errors: VerdictError[] = [
      {
        file: 'images/x.svg',
        half: null,
        line: null,
        col: null,
        rule: 'orphan-image',
        message: '',
        severity: 'warning',
      },
    ]
    expect(isOk(errors)).toBe(true)
  })
})

describe('hasLeadingFrontmatter', () => {
  it('detects a leading --- fence', () => {
    expect(hasLeadingFrontmatter('---\nauthors:\n  - X\n---\nbody')).toBe(true)
  })

  it('is false for a content-only body', () => {
    expect(hasLeadingFrontmatter('A statement with no fence.')).toBe(false)
  })
})

describe('splitOnSentinel', () => {
  it('returns the whole body as the statement when there is no sentinel', () => {
    const result = splitOnSentinel('line one\nline two')
    expect(result.statement).toBe('line one\nline two')
    expect(result.solution).toBeNull()
    expect(result.solutionBodyLine0).toBeNull()
  })

  it('splits statement and solution on the sentinel', () => {
    const result = splitOnSentinel('statement\n<!-- solution -->\nsolution')
    expect(result.statement).toBe('statement')
    expect(result.solution).toBe('solution')
    expect(result.solutionBodyLine0).toBe(2)
  })

  it('yields an empty statement when the sentinel comes first', () => {
    const result = splitOnSentinel('<!-- solution -->\nonly solution')
    expect(result.statement).toBe('')
    expect(result.solution).toBe('only solution')
  })

  it('keeps a whitespace-only solution half', () => {
    const result = splitOnSentinel('statement\n<!-- solution -->\n   ')
    expect(result.solution).toBe('   ')
  })
})

describe('parseProblemMeta', () => {
  it('defaults when the file is empty', () => {
    const result = parseProblemMeta('')
    expect(result.error).toBeNull()
    expect(result.meta).toEqual({ authors: null, solutionLink: null, tags: null })
  })

  it('parses authors and an optional solution link', () => {
    const result = parseProblemMeta('authors:\n  - A\n  - B\nsolutionLink: https://x.test')
    expect(result.error).toBeNull()
    expect(result.meta).toEqual({ authors: ['A', 'B'], solutionLink: 'https://x.test', tags: null })
  })

  it('keeps an absent authors key as null, distinct from an explicit empty clear', () => {
    // No authors key — leave existing authors untouched (null), not clear them ([]).
    expect(parseProblemMeta('solutionLink: https://x.test').meta.authors).toBeNull()

    // An explicit empty list is a clear, not the absent default.
    expect(parseProblemMeta('authors: []').meta.authors).toEqual([])
  })

  it('rejects authors that are not a list of strings', () => {
    const result = parseProblemMeta('authors: not a list')
    expect(result.error).toContain('authors')
  })

  it('rejects a non-string solution link', () => {
    const result = parseProblemMeta('solutionLink: 42')
    expect(result.error).toContain('solutionLink')
  })

  it('parses a tag list when present', () => {
    const result = parseProblemMeta('tags:\n  - algebra\n  - pigeonhole')
    expect(result.error).toBeNull()
    expect(result.meta.tags).toEqual(['algebra', 'pigeonhole'])
  })

  it('keeps an absent tags key as null, distinct from an explicit empty clear', () => {
    // No tags key — leave existing tags untouched (null), not clear them ([]).
    expect(parseProblemMeta('authors:\n  - A').meta.tags).toBeNull()

    // An explicit empty list is a clear, not the absent default.
    expect(parseProblemMeta('tags: []').meta.tags).toEqual([])
  })

  it('rejects tags that are not a list of strings', () => {
    const result = parseProblemMeta('tags: not a list')
    expect(result.error).toContain('tags')
  })

  it('reports malformed YAML rather than throwing', () => {
    const result = parseProblemMeta('authors: [A')
    expect(result.error).toContain('valid YAML')
  })
})

describe('narrowMeta', () => {
  it('accepts a complete meta document', () => {
    const { meta, errors } = narrowMeta({
      competition: 'csmo',
      category: 'a',
      round: 'iii',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'sk',
    })
    expect(errors).toEqual([])
    expect(meta).toEqual({
      competition: 'csmo',
      category: 'a',
      round: 'iii',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'sk',
    })
  })

  it('treats an absent category as null without erroring', () => {
    const { meta, errors } = narrowMeta({
      competition: 'imo',
      round: 'i',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'en',
    })
    expect(meta.category).toBeNull()
    expect(errors).toEqual([])
  })

  it('treats an absent round as null without erroring (default-round competition)', () => {
    const { meta, errors } = narrowMeta({
      competition: 'imo',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'en',
    })
    expect(meta.round).toBeNull()
    expect(errors).toEqual([])
  })

  it('errors on a missing competition', () => {
    const { errors } = narrowMeta({
      round: 'iii',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('competition'))).toBe(true)
  })

  it('errors on a missing season', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      date: '2024-03-15',
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('season'))).toBe(true)
  })

  it('errors on a missing date', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      season: { year: 2024 },
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('date'))).toBe(true)
  })

  it('errors on a date that is not a real calendar date', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      season: { year: 2024 },
      date: '2024-13-01',
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('date'))).toBe(true)
  })

  it('errors on a misshapen date string', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      season: { year: 2024 },
      date: 'not-a-date',
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('date'))).toBe(true)
  })

  it('errors on an unsupported language', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      season: { year: 2024 },
      date: '2024-03-15',
      language: 'de',
    })
    expect(errors.some((error) => error.message.includes('language'))).toBe(true)
  })

  it('errors when the document is not a mapping', () => {
    const { errors } = narrowMeta('not a mapping')
    expect(errors[0]?.message).toContain('mapping')
  })
})

describe('toAbsoluteLine', () => {
  it('offsets a half-relative line to the source line', () => {
    expect(toAbsoluteLine(0, 1)).toBe(1)
    expect(toAbsoluteLine(5, 2)).toBe(7)
  })

  it('passes through a null position', () => {
    expect(toAbsoluteLine(4, null)).toBeNull()
  })

  it('composes with the sentinel split on a content-only body', () => {
    const body = ['statement line', '<!-- solution -->', 'solution line 1', 'solution line 2'].join(
      '\n'
    )

    // The solution half begins on the body line after the sentinel
    const { solutionBodyLine0 } = splitOnSentinel(body)
    expect(solutionBodyLine0).toBe(2)

    // The second solution line therefore maps to source line 4
    expect(toAbsoluteLine(solutionBodyLine0 ?? 0, 2)).toBe(4)
  })
})

describe('collectImageNames', () => {
  it('collects images/ basenames, ignoring code blocks and external URLs', () => {
    const markdown = [
      '![a](images/a.svg)',
      '',
      '```',
      '![b](images/b.svg)',
      '```',
      '',
      '![c](https://example.com/c.png)',
      '',
      '![a-again](images/a.svg?width=10)',
    ].join('\n')

    // Only the real images/ references survive; the code-fenced and external ones do not, and duplicates collapse
    expect(collectImageNames(markdown)).toEqual(['a.svg'])
  })
})
