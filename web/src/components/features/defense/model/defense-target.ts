import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { DEFENSE_DRAFT_STORAGE_PREFIX } from '@/constants/local-storage-constants'

import type { DefenseSessionTarget } from './defense-types'

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
  /** The competition the problem is set in. */
  competitionId: string
  /** The problem's id within that competition. */
  problemId: string
  /** Whose entry it is being argued under, or null for a reader the program does not know. */
  readerKey: string | null
}

/**
 * What a defense is held against: a handout's environment, or a competition's problem.
 */
export type DefenseTarget = HandoutDefenseTarget | CompetitionDefenseTarget

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

    // A competition problem is an archive problem, so it travels as its own id
    case 'competition':
      return { kind: 'problem', problemId: target.problemId }

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Names what a defense would be opened against, which is what a conversation may not change under.
 *
 * Read off the wire target, so two targets the API cannot tell apart are the same defense and key alike.
 *
 * The ids travel as a JSON array, which keeps them bounded whatever characters an id turns out to hold:
 * joined by a separator, `a` and `b:c` would key alike with `a:b` and `c`.
 *
 * @param target - What the defense is held against.
 *
 * @returns The key.
 */
export function defenseTargetKey(target: DefenseTarget): string {
  // The target as the API names it
  const wireTarget = toWireTarget(target)

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
 * Reads the handout environment a target names.
 *
 * @param target - The target being read.
 *
 * @returns The environment, or null for a defense held somewhere other than a handout.
 */
export function handoutTargetOf(target: DefenseTarget): HandoutEnvironmentTarget | null {
  switch (target.kind) {
    // A handout defense is the one that has one
    case 'handout':
      return target.environment

    // A competition problem lives in no handout
    case 'competition':
      return null

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Names where a target's unsent composer text is kept.
 *
 * Keyed by the problem rather than the conversation, so a draft survives starting a fresh conversation
 * about the same problem, and by the reader on top of that, a browser being a thing students share.
 *
 * @param target - The target the text is being written against.
 *
 * @returns The storage key, or null for a target whose drafts are not kept past the chat closing.
 */
export function defenseDraftStorageKey(target: DefenseTarget): string | null {
  switch (target.kind) {
    // A competition entry is irreversible and its clock runs, so a stray reload must not cost the
    // half-written solution
    case 'competition':
      return [
        DEFENSE_DRAFT_STORAGE_PREFIX,
        'competition',
        target.readerKey ?? 'anonymous',
        target.competitionId,
        target.problemId,
      ].join(':')

    // A handout problem can be reopened whenever, so its draft lives only as long as the chat does
    case 'handout':
      return null

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Forgets whatever unsent composer text is being kept against one target.
 *
 * A competition problem's draft is keyed by the problem, which outlives the entry: a fresh entry is a
 * fresh run, and until this is called the last one's half-written turn is waiting in its composer.
 *
 * @param target - Whose text to forget.
 */
export function forgetDefenseDraft(target: DefenseTarget): void {
  // Where it would be kept, if it is kept anywhere
  const storageKey = defenseDraftStorageKey(target)

  // A target whose drafts never outlive the chat has nothing left to forget
  if (storageKey === null) {
    return
  }

  // A browser can refuse storage outright, and a draft is not worth failing an entry over
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Nothing to do about it: whatever is in there is what the composer opens on
  }
}
