/**
 * The draft-preflight manifest contract plus the verdict shapes that describe a
 * run's issues.
 */

import type { Locale } from '../src/i18n/i18n'

/** A problem's two markdown halves. */
export type ProblemHalf = 'statement' | 'solution'

/** Whether a verdict entry blocks import (`error`) or is merely advisory (`warning`). */
export type VerdictSeverity = 'error' | 'warning'

/** A competition season, identified by the calendar year it starts in. */
export type Season = {
  /** Calendar year the season starts in (e.g. 2024 for the 2024/2025 season). */
  year: number
}

/** Folder-level taxonomy, slugs verbatim from `_meta.yaml`. */
export type ManifestMeta = {
  /** Competition slug (e.g. `csmo`). */
  competition: string
  /** Category slug (e.g. `a`), or `null` when the competition has no categories. */
  category: string | null
  /** Round slug (e.g. `iii`), or `null` for a competition whose single round is the default (e.g. IMO). */
  round: string | null
  /** Season the draft belongs to. */
  season: Season
  /** Round-instance date as `YYYY-MM-DD`. */
  date: string
  /** The original language of this draft — the body whose `pN.<lang>.md` matches it is the original. */
  language: Locale
}

/** One language variant of a problem — the original or a translation, body parsed into its two halves. */
export type ManifestText = {
  /** Language of this text, taken from its `pN.<lang>.md` filename. */
  language: Locale
  /** `true` for the original (its language matches `meta.language`), `false` for a translation. */
  original: boolean
  /** Statement markdown verbatim, still carrying relative `images/…` references. */
  statementMarkdown: string
  /** Solution markdown verbatim, or `null` when this text has no solution sentinel. */
  solutionMarkdown: string | null
}

/** One problem's normalized content. */
export type ManifestProblem = {
  /** 1-based position within the round, taken from the `pN.yaml` / `pN.<lang>.md` filenames. */
  order: number
  /**
   * `true` when a `pN.yaml` sidecar file exists for this problem. A newly-created problem with no sidecar is
   * flagged; a re-import may omit it (absent sidecar = leave the stored authors/tags/link untouched).
   */
  hasSidecar: boolean
  /**
   * Author display names in declared order, or `null` when the `pN.yaml` omits an `authors:` key. An absent key
   * stays `null` (leave existing authors untouched) rather than defaulting to `[]` (clear) — omit and clear stay
   * distinct.
   */
  authors: string[] | null
  /** External solution URL, or `null` when absent. */
  solutionLink: string | null
  /**
   * Tag slugs to assign, or `null` when the `pN.yaml` omits a `tags:` key. An absent key stays `null` (leave
   * existing tags untouched) rather than defaulting to `[]` (clear) — omit and clear stay distinct.
   */
  tags: string[] | null
  /** Language variants — the original first, then translations in supported-locale order. */
  texts: ManifestText[]
  /** Basenames of every image referenced across this problem's texts (flat, under `images/`). */
  images: string[]
}

/** One issue found during preflight — an error or warning with its source location. */
export type VerdictError = {
  /** File the issue was found in (e.g. `p1.en.md`, `p1.yaml`, or `_meta.yaml`). */
  file: string
  /** Half the issue belongs to, or `null` for file-level issues. */
  half: ProblemHalf | null
  /** 1-based source line, or `null` when the issue carries no position. */
  line: number | null
  /** 1-based source column, or `null` when the issue carries no position. */
  col: number | null
  /** Machine-readable issue category (e.g. `katex`, `missing-image`, `meta`). */
  rule: string
  /** Human-readable description. */
  message: string
  /** Whether the issue blocks import or is advisory. */
  severity: VerdictSeverity
}

/** The issues a run surfaced. */
type Verdict = {
  /** Every error and warning found, in deterministic file order. */
  errors: VerdictError[]
}

/** The assembled draft-preflight manifest. */
export type DraftManifest = {
  /** Folder-level taxonomy. */
  meta: ManifestMeta
  /** One entry per problem, ordered by problem number. */
  problems: ManifestProblem[]
  /** The pass/fail decision and its supporting issues. */
  verdict: Verdict
}
