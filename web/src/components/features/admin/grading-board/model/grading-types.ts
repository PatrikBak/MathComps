import type {
  HostedCompetitionCategory,
  StudentBackground,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'
import type { LocalizedString } from '@/i18n/i18n'

import type { Grade } from '../../grades/model/grade-types'

/**
 * One problem of a competition being graded.
 */
export type GradingProblem = {
  /** Stable identifier. */
  id: string
  /** Its slug. */
  slug: string
  /** Its 1-based position in the competition. */
  number: number
}

/**
 * One entrant of a competition being graded.
 */
export type GradingEntrant = {
  /** Who they are. */
  user: UserIdentity
  /** When their clock started, as an ISO-8601 string. */
  startedAt: string
  /** When they closed the entry themselves, as an ISO-8601 string; null while they have not. */
  finishedAt: string | null
  /**
   * The sum, over the competition's problems, of how far into their own clock they last wrote about each one while
   * their entry counted, in seconds.
   */
  finishedAfterSeconds: number
} & StudentBackground

/**
 * One entrant's grade on one problem, with how many conversations it is read from.
 */
export type GradeSummary = {
  /** The entrant. */
  userId: string
  /** The problem. */
  problemId: string
  /** How many conversations the entrant held about the problem while their entry counted. */
  conversationCount: number
  /** Where it stands; null while nobody has given one. */
  grade: Grade | null
}

/**
 * One competition of a group, with its entrants and their grade on every problem.
 */
export type GradingCompetition = {
  /** The round that is the competition. */
  roundId: string
  /** Which level it runs at. */
  category: HostedCompetitionCategory
  /** Its problems in order. */
  problems: GradingProblem[]
  /** Everyone graded in it who spoke about any of its problems while their entry counted. */
  entrants: GradingEntrant[]
  /** Every entrant's grade on every problem. */
  grades: GradeSummary[]
}

/**
 * The group being graded: what it is called, when it took entries, and how long each entrant's clock runs.
 */
export type GradingGroup = {
  /** What a heading calls the group, in every language the site is read in. */
  name: LocalizedString
  /** When the group started taking entries, as an ISO-8601 string. */
  opensAt: string
  /** When it stopped, as an ISO-8601 string. */
  closesAt: string
  /** How long an entrant's own clock runs once they enter, in minutes. */
  clockMinutes: number
}

/**
 * Everything grading one group starts from: which group it is, how long a note stays open after an entry ends, and
 * each of its competitions.
 */
export type GradingBoard = GradingGroup & {
  /** How long after an entry ends its student may still comment on their own solutions, in minutes. */
  noteGraceMinutes: number
  /** Its competitions, in the order it sets the categories out. */
  competitions: GradingCompetition[]
}
