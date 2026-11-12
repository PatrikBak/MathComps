import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import { resolveHandoutProblemRef } from '@/components/features/handouts/handout-problem-ref'
import { assertNever } from '@/components/shared/utils/assert-never'
import {
  DEFENSE_DRAFT_PHOTOS_STORAGE_PREFIX,
  DEFENSE_DRAFT_STORAGE_PREFIX,
} from '@/constants/local-storage-constants'
import { forgetPersistentDraft } from '@/hooks/use-persistent-draft'
import type { Locale } from '@/i18n/i18n'

import type { DefenseSessionTarget, NamedDefenseTarget } from './defense-types'

/**
 * A defense held against one environment of a published handout.
 */
type HandoutDefenseTarget = {
  /** The discriminant. */
  kind: 'handout'
  /** The handout environment the defense is held against. */
  environment: HandoutEnvironmentTarget
}

/**
 * A defense held against one problem of a hosted competition.
 */
type CompetitionDefenseTarget = {
  /** The discriminant. */
  kind: 'competition'
  /** The problem's id. */
  problemId: string
}

/**
 * A defense held against a problem proposed for the competitions' papers.
 */
type ProposalDefenseTarget = {
  /** The discriminant. */
  kind: 'proposal'
  /** The problem's id. */
  problemId: string
}

/**
 * What a defense is held against: a handout's environment, a competition's problem, or a proposed one.
 */
export type DefenseTarget = HandoutDefenseTarget | CompetitionDefenseTarget | ProposalDefenseTarget

/**
 * Which competition a conversation was held in, read off what it was held against.
 *
 * @param target - What the defense was held against.
 *
 * @returns What addresses the competition, or null for a conversation no competition set.
 */
export function competitionSlugOf(target: NamedDefenseTarget): string | null {
  switch (target.kind) {
    // An archive problem names the competition it was set in
    case 'problem':
      return target.competitionSlug

    // A handout environment belongs to no competition, and no competition has set a proposal
    case 'handout':
    case 'proposal':
      return null

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Turns a target the surface works in into the shape the API takes.
 *
 * @param target - What the defense is held against.
 *
 * @returns The same target, flattened onto the wire.
 */
export function toWireTarget(target: DefenseTarget): DefenseSessionTarget {
  switch (target.kind) {
    // A handout environment travels as its two content ids
    case 'handout':
      return { kind: 'handout', ...target.environment }

    // A competition's problem and a proposed one are both archive problems, so each travels as its own id
    case 'competition':
    case 'proposal':
      return { kind: 'problem', problemId: target.problemId }

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Turns what a conversation was held against, as a surface names it, into the shape the API takes.
 *
 * @param target - What the conversation was held against.
 *
 * @returns The same target, its names dropped.
 */
export function toSessionTarget(target: NamedDefenseTarget): DefenseSessionTarget {
  switch (target.kind) {
    // A handout environment is named by its ids alone, which is what travels
    case 'handout':
      return target

    // An archive problem and a proposed one both travel as the problem's id
    case 'problem':
    case 'proposal':
      return { kind: 'problem', problemId: target.problemId }

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Names what a defense would be opened against, which is what a conversation may not change under.
 *
 * Built from the ids alone, so two targets the API cannot tell apart are the same defense and key alike,
 * whatever display names either of them carries.
 *
 * The ids travel as a JSON array, which keeps them bounded whatever characters an id turns out to hold:
 * joined by a separator, `a` and `b:c` would key alike with `a:b` and `c`.
 *
 * @param wireTarget - What the defense is held against, as the API names it.
 *
 * @returns The key.
 */
export function defenseTargetKey(wireTarget: DefenseSessionTarget): string {
  // Name it by the ids its kind carries
  switch (wireTarget.kind) {
    // A handout environment is named by the handout and the environment within it
    case 'handout':
      return JSON.stringify(['handout', wireTarget.handoutContentId, wireTarget.environmentId])

    // An archive problem is named by its own id
    case 'problem':
      return JSON.stringify(['problem', wireTarget.problemId])

    // Every wire target is handled above
    default:
      return assertNever(wireTarget)
  }
}

/**
 * Whether the reader's language still reaches what a defense is held against, which is what a fresh
 * conversation needs to have a subject at all.
 *
 * @param target - What the defense is held against.
 * @param locale - The language the reader is in.
 *
 * @returns Whether the subject is reachable.
 */
export function isSubjectReachable(target: DefenseTarget, locale: Locale): boolean {
  switch (target.kind) {
    // A handout's problem is published per language, and a target can outlive the handout it points at
    case 'handout':
      return resolveHandoutProblemRef(target.environment, locale) !== null

    // A competition's problem comes in with its statement, so the area that set it has already answered
    case 'competition':
      return true

    // A proposal is offered only where it has a solution to argue from, so the selection has already answered
    case 'proposal':
      return true

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Names where, under a prefix, one part of a reader's unsent composer about a target is kept.
 *
 * Keyed by what the defense is held against rather than by the conversation, so a draft survives starting a fresh
 * conversation about the same problem and is there wherever that problem's chat is opened. Keyed by the reader on
 * top of that, a browser being a thing students share.
 *
 * @param prefix - What the part is kept under.
 * @param readerId - The signed-in reader, or null while nobody is signed in.
 * @param target - The target the composer is being written against.
 *
 * @returns The storage key, or null where nothing is kept.
 */
function draftStorageKeyUnder(
  prefix: string,
  readerId: string | null,
  target: DefenseTarget
): string | null {
  // Nobody signed in, so nobody to keep a draft for
  if (readerId === null) return null

  // The reader, then what the defense is held against, keyed alike wherever its chat is opened
  return [prefix, readerId, defenseTargetKey(toWireTarget(target))].join(':')
}

/**
 * Names where, under {@link DEFENSE_DRAFT_STORAGE_PREFIX}, a reader's unsent composer text about a target is kept.
 *
 * @param readerId - The signed-in reader, or null while nobody is signed in.
 * @param target - The target the text is being written against.
 *
 * @returns The storage key, or null where nothing is kept.
 */
export function defenseDraftStorageKey(
  readerId: string | null,
  target: DefenseTarget
): string | null {
  // The text's key, under its own prefix
  return draftStorageKeyUnder(DEFENSE_DRAFT_STORAGE_PREFIX, readerId, target)
}

/**
 * Names where, under {@link DEFENSE_DRAFT_PHOTOS_STORAGE_PREFIX}, the photos in a reader's unsent composer about a
 * target are kept. Those whose text is in the message go out with it, and the read ones wait for their text to go in.
 * They are kept wherever the message's text is.
 *
 * @param readerId - The signed-in reader, or null while nobody is signed in.
 * @param target - The target the text is being written against.
 *
 * @returns The storage key, or null where nothing is kept.
 */
export function defenseDraftPhotosStorageKey(
  readerId: string | null,
  target: DefenseTarget
): string | null {
  // The photos' key, under a prefix of their own
  return draftStorageKeyUnder(DEFENSE_DRAFT_PHOTOS_STORAGE_PREFIX, readerId, target)
}

/**
 * Forgets whatever unsent composer text a reader has kept against one target, and the photos kept beside it.
 *
 * A draft is keyed by the problem, which outlives a competition entry: a fresh entry is a fresh run, and until this
 * is called the last one's half-written turn is waiting in its composer.
 *
 * @param readerId - Whose draft to forget, or null while nobody is signed in.
 * @param target - What the draft was written against.
 */
export function forgetDefenseDraft(readerId: string | null, target: DefenseTarget): void {
  // The draft's text
  forgetPersistentDraft(defenseDraftStorageKey(readerId, target))

  // The draft's photos
  forgetPersistentDraft(defenseDraftPhotosStorageKey(readerId, target))
}
