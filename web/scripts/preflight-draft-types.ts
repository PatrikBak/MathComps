/**
 * The draft-preflight manifest contract — the single artifact the preflight
 * emits and the C# import CLI deserializes — plus the verdict shapes that
 * describe a run's issues. Kept in one place so both sides stay strongly typed.
 */

import type { Locale } from '../src/i18n/i18n'

/** A problem's two markdown halves, used to tag where an error was found. */
export type ProblemHalf = 'statement' | 'solution'

/** Whether a verdict entry blocks import (`error`) or is merely advisory (`warning`). */
export type VerdictSeverity = 'error' | 'warning'

/** A competition season, identified by the calendar year it starts in. */
export type Season = {
  /** Calendar year the season starts in (e.g. 2024 for the 2024/2025 season). */
  year: number
}

/** Folder-level taxonomy, slugs verbatim from `_meta.yaml` for the C# side to resolve. */
export type ManifestMeta = {
  /** Competition slug (e.g. `csmo`). */
  competition: string
  /** Category slug (e.g. `a`), or `null` when the competition has no categories. */
  category: string | null
  /** Round slug (e.g. `iii`). */
  round: string
  /** Season the draft belongs to. */
  season: Season
  /** Round-instance date as `YYYY-MM-DD`, feeding `RoundInstance.Date`. */
  date: string
  /** Source language of the draft — the original {@link ProblemText} language. */
  language: Locale
}

/** One problem's normalized content, ready for the C# side to persist as rows. */
export type ManifestProblem = {
  /** 1-based position within the round, taken from the `pN.md` filename. */
  order: number
  /** Author display names in declared order. */
  authors: string[]
  /** External solution URL, or `null` when absent. */
  solutionLink: string | null
  /** Statement markdown verbatim, still carrying relative `images/…` references. */
  statementMarkdown: string
  /** Solution markdown verbatim, or `null` when the draft has no solution sentinel. */
  solutionMarkdown: string | null
  /** Basenames of the images this problem references (flat, under `images/`). */
  images: string[]
}

/** One issue found during preflight — an error or warning with its source location. */
export type VerdictError = {
  /** File the issue was found in (e.g. `p1.md` or `_meta.yaml`). */
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

/** The single artifact a preflight run produces — the C# import contract. */
export type DraftManifest = {
  /** Folder-level taxonomy. */
  meta: ManifestMeta
  /** One entry per `pN.md`, ordered by problem number. */
  problems: ManifestProblem[]
  /** The pass/fail decision and its supporting issues. */
  verdict: Verdict
}
