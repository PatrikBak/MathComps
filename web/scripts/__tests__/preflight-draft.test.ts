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
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

import { isOk, preflightDraft } from '../preflight-draft-core'
import { narrowMeta } from '../preflight-draft-meta'
import {
  collectImageNames,
  parseFrontmatter,
  splitFrontmatter,
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
  it('parses meta, both halves, authors, and image refs', async () => {
    const manifest = await loadFixture('valid-basic')

    // Two problems, ordered by filename
    expect(manifest.problems.map((problem) => problem.order)).toEqual([1, 2])

    // The first problem has a solution; the second (no sentinel) does not
    const [first, second] = manifest.problems
    expect(first!.solutionMarkdown).not.toBeNull()
    expect(second!.solutionMarkdown).toBeNull()

    // Author names survive parsing, including diacritics
    expect(first!.authors).toEqual(['Jaromír Šimša'])

    // Image references are reduced to basenames and the body still carries the relative ref for C#
    expect(first!.images).toEqual(['incircle.svg'])
    expect(first!.statementMarkdown).toContain('images/incircle.svg')

    // Taxonomy is carried through verbatim
    expect(manifest.meta.competition).toBe('csmo')
    expect(manifest.meta.category).toBe('a')
    expect(manifest.meta.round).toBe('iii')
    expect(manifest.meta.season).toEqual({ year: 2024, edition: 65 })
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

  it('defaults authors when a problem has no frontmatter', async () => {
    const manifest = await loadFixture('valid-no-frontmatter')
    expect(manifest.problems[0]!.authors).toEqual([])
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

  it('flags a missing required meta field', async () => {
    const manifest = await loadFixture('invalid-missing-meta-round')
    const error = findError(manifest, (entry) => entry.rule === 'meta')
    expect(error?.file).toBe('_meta.yaml')
    expect(error?.message).toContain('round')
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

  it('flags malformed frontmatter without throwing', async () => {
    const manifest = await loadFixture('invalid-bad-frontmatter')
    const error = findError(manifest, (entry) => entry.rule === 'frontmatter')
    expect(error?.message).toContain('authors')
  })

  it('flags an empty statement', async () => {
    const manifest = await loadFixture('invalid-empty-statement')
    const error = findError(manifest, (entry) => entry.rule === 'empty-statement')
    expect(error?.half).toBe('statement')
  })

  it('flags non-contiguous problem numbering', async () => {
    const manifest = await loadFixture('invalid-noncontiguous')
    const error = findError(manifest, (entry) => entry.rule === 'problem-files')
    expect(error?.message).toContain('contiguous')
  })

  it('flags duplicate problem numbers', async () => {
    const manifest = await loadFixture('invalid-duplicate-order')
    const error = findError(manifest, (entry) => entry.message.includes('duplicate'))
    expect(error?.rule).toBe('problem-files')
  })

  it('flags a folder with no problems', async () => {
    const manifest = await loadFixture('invalid-no-problems')
    const error = findError(manifest, (entry) => entry.rule === 'problem-files')
    expect(error?.message).toContain('no pN.md')
  })

  it('flags an unterminated frontmatter block', async () => {
    const manifest = await loadFixture('invalid-unterminated-frontmatter')
    const error = findError(manifest, (entry) => entry.rule === 'frontmatter')
    expect(error?.message).toContain('terminated')
  })

  it('flags a problem list that does not start at 1', async () => {
    const manifest = await loadFixture('invalid-starts-at-two')
    const error = findError(manifest, (entry) => entry.rule === 'problem-files')
    expect(error?.message).toContain('p1.md')
  })
})

describe('isOk', () => {
  it('passes when there are no issues', () => {
    expect(isOk([])).toBe(true)
  })

  it('fails when any issue has error severity', () => {
    const errors: VerdictError[] = [
      {
        file: 'p1.md',
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

describe('splitFrontmatter', () => {
  it('returns the whole file as the body when there is no frontmatter', () => {
    const result = splitFrontmatter('line one\nline two')
    expect(result.frontmatterText).toBeNull()
    expect(result.body).toBe('line one\nline two')
    expect(result.bodyStartLine0).toBe(0)
    expect(result.unterminated).toBe(false)
  })

  it('separates a terminated frontmatter block from the body', () => {
    const result = splitFrontmatter('---\nauthors:\n  - X\n---\nbody line')
    expect(result.frontmatterText).toBe('authors:\n  - X')
    expect(result.body).toBe('body line')
    expect(result.bodyStartLine0).toBe(4)
    expect(result.unterminated).toBe(false)
  })

  it('flags an unterminated frontmatter block', () => {
    const result = splitFrontmatter('---\nauthors:\n  - X\nbody with no closing fence')
    expect(result.unterminated).toBe(true)
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

describe('parseFrontmatter', () => {
  it('defaults when there is no frontmatter', () => {
    const result = parseFrontmatter(null)
    expect(result.error).toBeNull()
    expect(result.frontmatter).toEqual({ authors: [], solutionLink: null })
  })

  it('parses authors and an optional solution link', () => {
    const result = parseFrontmatter('authors:\n  - A\n  - B\nsolutionLink: https://x.test')
    expect(result.error).toBeNull()
    expect(result.frontmatter).toEqual({ authors: ['A', 'B'], solutionLink: 'https://x.test' })
  })

  it('rejects authors that are not a list of strings', () => {
    const result = parseFrontmatter('authors: not a list')
    expect(result.error).toContain('authors')
  })

  it('rejects a non-string solution link', () => {
    const result = parseFrontmatter('solutionLink: 42')
    expect(result.error).toContain('solutionLink')
  })

  it('reports malformed YAML rather than throwing', () => {
    const result = parseFrontmatter('authors: [A')
    expect(result.error).toContain('valid YAML')
  })
})

describe('narrowMeta', () => {
  it('accepts a complete meta document', () => {
    const { meta, errors } = narrowMeta({
      competition: 'csmo',
      category: 'a',
      round: 'iii',
      season: { year: 2024, edition: 65 },
      language: 'sk',
    })
    expect(errors).toEqual([])
    expect(meta).toEqual({
      competition: 'csmo',
      category: 'a',
      round: 'iii',
      season: { year: 2024, edition: 65 },
      language: 'sk',
    })
  })

  it('treats an absent category as null without erroring', () => {
    const { meta, errors } = narrowMeta({
      competition: 'imo',
      round: 'i',
      season: { year: 2024, edition: 65 },
      language: 'en',
    })
    expect(meta.category).toBeNull()
    expect(errors).toEqual([])
  })

  it('errors on a missing required field', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      season: { year: 2024, edition: 65 },
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('round'))).toBe(true)
  })

  it('errors on a missing season', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      language: 'sk',
    })
    expect(errors.some((error) => error.message.includes('season'))).toBe(true)
  })

  it('errors on an unsupported language', () => {
    const { errors } = narrowMeta({
      competition: 'csmo',
      round: 'iii',
      season: { year: 2024, edition: 65 },
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

  it('composes with the frontmatter and sentinel splits', () => {
    const file = [
      '---',
      'authors:',
      '  - X',
      '---',
      'statement line',
      '<!-- solution -->',
      'solution line 1',
      'solution line 2',
    ].join('\n')

    // The body begins on the line after the closing fence
    const { body, bodyStartLine0 } = splitFrontmatter(file)
    expect(bodyStartLine0).toBe(4)

    // The solution half begins two body lines in (statement + sentinel)
    const { solutionBodyLine0 } = splitOnSentinel(body)
    expect(solutionBodyLine0).toBe(2)

    // The second solution line therefore maps to source line 8
    const solutionStartLine0 = bodyStartLine0 + (solutionBodyLine0 ?? 0)
    expect(toAbsoluteLine(solutionStartLine0, 2)).toBe(8)
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
