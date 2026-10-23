import type {
  CommentDto,
  CommentThreadSeenDto,
} from '@/components/features/comments/services/comment-api-types'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'
import type { Locale } from '@/i18n/i18n'

/** Every area a proposal can be filed under. */
export const PROPOSAL_AREAS = ['algebra', 'combinatorics', 'geometry', 'numberTheory'] as const

/** One area a proposal is filed under. */
export type ProposalArea = (typeof PROPOSAL_AREAS)[number]

/** The longest working title a proposal holds, in characters. */
export const PROPOSAL_TITLE_MAX_LENGTH = 200

/** The language most proposals are authored in. */
export const PROPOSAL_AUTHORING_LANGUAGE = 'en' as const satisfies Locale

/** Every aspect a reviewer rates a proposal on. */
export const RATING_ASPECTS = ['beauty', 'difficulty'] as const

/** One aspect a reviewer rates a proposal on. */
export type RatingAspect = (typeof RATING_ASPECTS)[number]

/** A reviewer's score for each aspect, on the olympiad scale in tenths, null for an aspect they give none. */
export type RatingScores = Record<RatingAspect, number | null>

/** One reviewer's rating of a proposal, which scores at least one aspect. */
export type ProposalRating = {
  /** The reviewer who gave it. */
  rater: UserIdentity
  /** Whether the reader is the one who gave it. */
  isOwn: boolean
} & RatingScores

/**
 * One proposal's text in one language.
 */
export type ProposalText = {
  /** The statement as markdown/math source. */
  statement: string
  /** The full solution as markdown/math source, null until somebody writes one in this language. */
  solution: string | null
  /** The hints as markdown/math source, weakest nudge first. */
  hints: string[]
}

/**
 * One proposed problem, still in the pool or already taken by a round.
 */
export type Proposal = {
  /** The problem's id, which is also the proposal's. */
  id: string
  /** The number people quote when they talk about it, the same wherever it moves. */
  number: number
  /** Working name, never shown to a student. */
  title: string
  /** The area it belongs to. */
  area: ProposalArea
  /** The categories it is recommended for, by name, in the order the categories run. */
  recommended: string[]
  /** Its text in each language it has a statement in. */
  texts: Partial<Record<Locale, ProposalText>>
  /** The language it was first written in, which its other texts translate; null where none is the original. */
  originalLanguage: Locale | null
  /** Whether the reviewers have set it aside, which leaves it in the selection. */
  isSetAside: boolean
  /** Whether a round has taken it out of the pool. */
  isUsed: boolean
  /**
   * Every reviewer's rating of it, in the order of the reviewers' names, except the reader's first rating, which sits
   * last until the selection is read again.
   */
  ratings: ProposalRating[]
}

/**
 * One paper on a board: a named run of numbered slots.
 */
export type Paper = {
  /** Identity of the paper. */
  id: string
  /** What the paper is called. */
  name: string
  /** The category the paper fills, by name. */
  category: string
  /** The problem in each slot, by id, null where the slot stands empty. */
  slots: (string | null)[]
}

/**
 * The rounds a board was finalized into.
 */
type Finalization = {
  /** The name of the cycle whose rounds took the papers, in the language the site is read in. */
  cycleName: string
  /** When those rounds open, as an ISO-8601 string; the board leaves the selection once they do. */
  opensAt: string
}

/**
 * One board of the selection: a named set of papers whose slots are filled from the pool, tied to no cycle
 * until it is finalized into one.
 */
export type Board = {
  /** Identity of the board. */
  id: string
  /** What the board is called. */
  name: string
  /** Its papers, in the order the board sets them out. */
  papers: Paper[]
  /** The rounds it was finalized into, null while it is still a draft. */
  finalization: Finalization | null
}

/**
 * A batch of rounds that open together, one for each of its hosted levels, all still empty, so a board can be
 * finalized into them.
 */
export type Cycle = {
  /** Identity of the cycle. */
  id: string
  /** What it is called, in the language the site is read in. */
  name: string
  /** When its rounds open, as an ISO-8601 string. */
  opensAt: string
  /** The hosted levels of its rounds, one paper's worth each. */
  categories: HostedCompetitionCategory[]
  /** How many problems each of its rounds takes. */
  problemCount: number
}

/**
 * One slot, addressed from outside its board.
 */
export type SlotAddress = {
  /** The board holding it. */
  boardId: string
  /** The paper holding it. */
  paperId: string
  /** Its position in the paper, from zero. */
  index: number
}

/** Which neighbour a slot trades with when it moves: the one above it, or the one below. */
export type SlotDirection = 'up' | 'down'

/**
 * A proposal going into a slot.
 */
export type PlacementWrite = {
  /** Where the proposal goes. */
  slot: SlotAddress
  /** The proposal. */
  proposalId: string
}

/**
 * A slot trading places with its neighbour.
 */
export type MoveWrite = {
  /** The slot. */
  slot: SlotAddress
  /** Which neighbour the slot trades with. */
  direction: SlotDirection
}

/**
 * A proposal being set aside or brought back.
 */
export type SetAsideWrite = {
  /** The proposal. */
  proposalId: string
  /** Whether the proposal is set aside afterwards. */
  isSetAside: boolean
}

/**
 * A proposal's recommendation for one category switching on or off.
 */
export type RecommendationWrite = {
  /** The proposal. */
  proposalId: string
  /** The category, by name. */
  category: string
  /** Whether the proposal is recommended for the category afterwards. */
  isRecommended: boolean
}

/**
 * The reader's rating of a proposal being set, or taken back where it scores no aspect.
 */
export type RatingWrite = {
  /** The proposal. */
  proposalId: string
  /** The reader's scores afterwards. */
  scores: RatingScores
}

/**
 * A board going into a cycle's rounds.
 */
export type FinalizationWrite = {
  /** The board. */
  boardId: string
  /** The cycle whose rounds take the board's papers. */
  cycleId: string
}

/**
 * A summary of one reviewer's conversation with Mathilda about a proposal.
 */
export type ReviewConversation = {
  /** Identity of the conversation. */
  id: string
  /** The proposal it was about. */
  proposalId: string
  /** The reviewer who held it. */
  author: UserIdentity
  /** When it started, as an ISO-8601 string. */
  startedAt: string
  /** How many messages were said in it. */
  messageCount: number
  /** Whether it was argued against a statement the proposal no longer has in any language. */
  hasOlderStatement: boolean
}

/**
 * One category the selection's organization picks problems for.
 */
export type SelectionCategory = {
  /** What the organization calls it, unique among its categories. */
  name: string
  /** The hosted level it is, whose round takes a paper of this category; null for one no hosted round runs. */
  hostedCategory: HostedCompetitionCategory | null
}

/**
 * The slug of the organization preparing the competitions the site hosts, as the API names it.
 */
export const MATHCOMPS_ORGANIZATION_SLUG = 'mathcomps'

/**
 * Everything the selection reads, which arrives in one go.
 */
export type SelectionData = {
  /** The categories the selection picks problems for, in the order they run. */
  categories: SelectionCategory[]
  /** The names of the categories the reader leads, in the order they run. */
  leadCategories: string[]
  /** Every proposal still in the selection, the set-aside and used ones included, lowest number first. */
  proposals: Proposal[]
  /** Every board still in the selection, oldest first. */
  boards: Board[]
  /** The cycles a board can be finalized into, soonest first. */
  cycles: Cycle[]
  /** Every conversation a reviewer held about a proposal still in the selection, newest first. */
  conversations: ReviewConversation[]
  /**
   * Whether its problems need a statement and a solution in every language the site is read in, as a hosted round
   * does; where false, any one text will do.
   */
  needsEveryLanguage: boolean
}

/**
 * The reviewers' discussions of everything the selection holds, each kind of subject's by the subject's id. Each
 * discussion is its top-level comments, oldest first, each carrying its replies, and one nothing has been said in is
 * left out.
 */
export type SelectionDiscussions = {
  /** The discussions of the proposals still in the selection, by the proposal's id. */
  proposals: Record<string, CommentDto[]>
  /** The discussions of the papers on the selection's boards, by the paper's id. */
  papers: Record<string, CommentDto[]>
}

/**
 * How far the reader has seen the discussions of everything the selection holds, each kind of subject's by the
 * subject's id. Every proposal and paper the selection holds has an entry, one nothing has been said in included.
 */
export type SelectionDiscussionsSeen = {
  /** How far the reader has seen each proposal's discussion, by the proposal's id. */
  proposals: Record<string, CommentThreadSeenDto>
  /** How far the reader has seen each paper's discussion, by the paper's id. */
  papers: Record<string, CommentThreadSeenDto>
}

/**
 * How far the reader has seen some of the discussions of what the selection holds, each up to its own moment, each kind
 * of subject's by the subject's id.
 */
export type DiscussionsSeenUpTo = {
  /**
   * The moment up to which the reader has seen every comment posted in each proposal's discussion, by the proposal's id
   * (ISO 8601 strings).
   */
  proposals: Record<string, string>
  /**
   * The moment up to which the reader has seen every comment posted in each paper's discussion, by the paper's id (ISO
   * 8601 strings).
   */
  papers: Record<string, string>
}
