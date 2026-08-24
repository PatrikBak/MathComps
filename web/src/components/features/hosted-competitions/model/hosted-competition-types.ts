import type { LocalizedString } from '@/i18n/i18n'

/**
 * One competition: one category, one problem set, one clock.
 */
export type HostedCompetition = {
  /** Identifies the competition. */
  id: string
  /** Which level it runs at, or null for the practice one, which sits outside the levels entirely. */
  category: HostedCompetitionCategory | null
  /** The student's entry, or null while they have not taken it. */
  entry: HostedCompetitionEntry | null
  /**
   * Whether its results have been published.
   *
   * A fact about the competition rather than the reader: once out, they are out for everybody.
   */
  resultsPublished: boolean
  /**
   * Whether the problems are public.
   *
   * They open to everybody once the competition is over. Before that, the only way to them is to spend the
   * entry, by sitting it or by giving it up to read them.
   */
  problemsPublished: boolean
}

/**
 * One problem of a competition's set, as an entrant reads it: the statement, and nothing it is measured
 * against.
 */
export type HostedCompetitionProblem = {
  /** Stable identifier, unique within its competition. */
  id: string
  /** Where it sits in the set, counting from one. */
  position: number
  /** The statement as markdown/math source, in every language the site is read in. */
  statement: LocalizedString
  /** The conversations the student has held about it, most recently active first. */
  defenses: HostedCompetitionDefenseLine[]
}

/**
 * One conversation a student has held about one problem, as its row on the problem says it.
 *
 * Enough to choose between them and no more. What was last said stays out: the most recent line is
 * usually the examiner's challenge, and reading it back on the page would spoil it.
 */
export type HostedCompetitionDefenseLine = {
  /** The defense session it leads to. */
  sessionId: string
  /** When the student opened it, as an ISO-8601 string. */
  startedAt: string
  /** How many turns the student has spent in it. */
  turnsSpent: number
  /** The most turns it will take, so a row can say how much room is left. */
  maxTurns: number
}

/**
 * The levels a group runs, easiest first. Each is a difficulty a student picks, not a bucket they are put in.
 */
export const HOSTED_COMPETITION_CATEGORIES = ['elementary', 'intermediate', 'advanced'] as const

/**
 * Which level a competition runs at.
 */
export type HostedCompetitionCategory = (typeof HOSTED_COMPETITION_CATEGORIES)[number]

/**
 * One student's single entry into one competition.
 *
 * The times rather than a verdict: a clock runs out with nobody asking the server, so whoever holds an
 * entry can tell where it stands for themselves.
 */
export type HostedCompetitionEntry = SatEntry | ForfeitedEntry

/**
 * An entry the student sat, whether or not its clock has run out.
 */
export type SatEntry = {
  /** The discriminant. */
  kind: 'sat'
  /** When the student entered, which is when their clock started, as an ISO-8601 string. */
  startedAt: string
  /** When the student closed the entry themselves, as an ISO-8601 string; null while they have not. */
  finishedAt: string | null
}

/**
 * An entry the student gave up to read the problems, so no clock ever ran.
 *
 * Its own member rather than a sat entry with nothing under it: only a sat one belongs in a result.
 */
type ForfeitedEntry = {
  /** The discriminant. */
  kind: 'forfeited'
  /** When the student gave the entry up, as an ISO-8601 string. */
  forfeitedAt: string
}

/**
 * What spending an entry hands back: the entry itself, and the problems it bought.
 *
 * One answer carrying both. The clock starts where the entry is taken, so a student left waiting on a
 * second read for the statements reaches them having already spent some of their own time.
 */
export type SpentEntry = {
  /** The entry as it now stands. */
  entry: HostedCompetitionEntry
  /** The competition's problems, in the order it sets them. */
  problems: HostedCompetitionProblem[]
}

/**
 * One competition and the group it belongs to, which carries the terms it runs on.
 */
export type PendingEntry = {
  /** The group it runs in. */
  group: HostedCompetitionGroup
  /** The competition itself. */
  competition: HostedCompetition
}

/**
 * The batch of competitions that open and close together, one per category.
 *
 * Usually a month of the program, sometimes something named in its own right, so the name is a field
 * rather than something worked out from the dates.
 */
export type HostedCompetitionGroup = {
  /** Identifies the group. */
  id: string
  /** What a heading calls it, in every language the site is read in. */
  name: LocalizedString
  /** How many problems each of its competitions holds. */
  problemCount: number
  /** How long a student's own clock runs, in minutes. */
  clockMinutes: number
  /** When its competitions start taking entries, as an ISO-8601 string. */
  opensAt: string
  /**
   * When they stop, as an ISO-8601 string; null for a group that never closes, which is what makes it the
   * practice one.
   */
  closesAt: string | null
  /** Its competitions, in the order it sets the categories out. */
  competitions: HostedCompetition[]
}

/**
 * Everything the competitions surface reads.
 */
export type HostedCompetitionsView = {
  /** Every group the program has run, is running, or has announced. */
  groups: HostedCompetitionGroup[]
}

/**
 * Whether a student has everything an entry needs of them.
 *
 * A result has to name a student and reach them, so these are asked for before the clock rather than after.
 */
export type EntryReadiness = {
  /** The permanent nickname the student's results are published under, or null while they have none. */
  nickname: string | null
  /** The year the student graduates, or null while they have not given it. */
  graduationYear: number | null
  /** Whether the student has an address that has been confirmed to reach them. */
  hasVerifiedEmail: boolean
  /** Whether the student has ever accepted the competition rules. */
  hasAcceptedRules: boolean
}
