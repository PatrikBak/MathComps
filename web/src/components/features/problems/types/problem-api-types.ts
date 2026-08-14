// The problem archive's wire shapes, one per backend DTO. They are hand-written rather than generated,
// so a member added or renamed on the C# side has to be mirrored here by hand — a mismatch compiles
// cleanly and only surfaces as an undefined field at runtime.

/**
 * A thing named by a slug, carrying the names it reads under, both already in the requested language.
 */
export type LabeledSlug = {
  /** URL-safe identifier, unique among its siblings. */
  slug: string
  /** The short name it is shown by (e.g. `IMO`). */
  displayName: string
  /** The name in full, for a tooltip or a heading (e.g. `International Mathematical Olympiad`). */
  fullName?: string
}

/**
 * One value a facet can be filtered by, with how many problems it covers. The count is relative to
 * whatever the rest of the filter already narrowed to, so it moves as the other facets change.
 */
export type FacetOption = {
  /** URL-safe identifier for the option. */
  slug: string
  /** The short name it is shown by. */
  displayName: string
  /** The name in full, for a tooltip or a heading. */
  fullName?: string
  /** How many problems this option covers under the current filter. */
  count: number
  /** What kind of tag it is, present only on the tag facet. */
  tagType?: TagType
}

/** What a tag says about a problem: its field, its shape, what it asks for, or how it is solved. */
export type TagType = 'area' | 'type' | 'goal' | 'technique'

/** One tag on a problem, named in the requested language. */
export type TagDto = {
  /** URL-safe identifier for the tag. */
  slug: string
  /** The tag's name as it is shown. */
  displayName: string
  /** Its conceptual role. */
  tagType: TagType
}

/** How several picks within one facet combine: any of them, or all of them at once. */
type LogicToggle = 'or' | 'and'

/**
 * Where a problem comes from: the season it ran in, the competition it was set in, and its position there.
 */
type ProblemSource = {
  /** The season it was set in, whose slug is the edition number. */
  season: LabeledSlug
  /**
   * Every competition down to the one it was set in, root-first, so the last entry is the competition itself.
   * Each entry's `slug` is that competition's whole path rather than its own segment, which is what names a
   * competition at whatever depth it sits.
   */
  competition: LabeledSlug[]
  /** Its position within its competition, i.e. the 3rd problem. */
  number: number
}

/** A problem the backend judged close to the one being read, and how close. */
export type SimilarProblem = {
  /** URL-safe identifier for the problem. */
  slug: string
  /** Where it comes from. */
  source: ProblemSource
  /** Its statement, as Markdown with TeX in it. */
  statementMarkdown: string
  /** How close it is, from 0 to 1. */
  similarityScore: number
}

/** One problem in the archive, in full. */
export type Problem = {
  /** URL-safe identifier, unique across the archive. */
  slug: string
  /**
   * The statement, as Markdown with TeX in it. Served in the requested language when there is a
   * translation, and in the original otherwise.
   */
  statementMarkdown: string
  /** The key of its published solution, absent while none has been published. */
  solutionLink?: string | null
  /** Where it comes from. */
  source: ProblemSource
  /** What it is about, and how it is solved. */
  tags: TagDto[]
  /** Who set it, in the order they are credited. */
  authors: LabeledSlug[]
  /** The problems judged close to it, most similar first. */
  similarProblems: SimilarProblem[]
  /** Whether the reader has liked it; false while signed out. */
  liked: boolean
  /** Whether the reader has marked it; false while signed out. */
  marked: boolean
  /** How many readers have liked it. */
  likeCount: number
  /** How many comments it carries. */
  commentCount: number
  /** The reader's lists holding it, by content id. Empty while signed out. */
  listContentIds: string[]
}

/**
 * A search, as the backend reads it: identifiers and values only, with none of the display names the
 * UI keeps beside them.
 */
export type FilterParameters = {
  /** The free-text query, capped server-side at 500 characters. */
  searchText: string
  /** Whether the text query also runs over solutions rather than statements alone. */
  searchInSolution: boolean
  /** The edition numbers picked, e.g. 75 for the 75th. */
  olympiadYears: number[]
  /**
   * The competitions picked, each addressed by the slugs leading down to it (e.g. `csmo-a-i`) and standing
   * for that competition and everything under it.
   */
  competitionPaths: string[]
  /** The positions picked, i.e. every 3rd problem. */
  problemNumbers: number[]
  /** The tags picked. */
  tagSlugs: string[]
  /** Whether a problem must carry any of those tags or all of them. */
  tagLogic: LogicToggle
  /** The authors picked. */
  authorSlugs: string[]
  /** Whether a problem must be by any of those authors or by all of them. */
  authorLogic: LogicToggle
}

/**
 * One competition as the search bar offers it, carrying the competitions below it. The tree runs to whatever
 * depth the taxonomy does.
 */
export type CompetitionNodeOption = {
  /** The competition, addressed by the slugs leading down to it, e.g. `csmo-a-i`. */
  path: string
  /** The short name it is shown by (e.g. `Domáce kolo`). */
  displayName: string
  /** The name in full (e.g. `Kategória A`). */
  fullName: string
  /** How many problems sit anywhere under it, itself included. */
  count: number
  /** The competitions one level below it, empty at a leaf. */
  children: CompetitionNodeOption[]
}
