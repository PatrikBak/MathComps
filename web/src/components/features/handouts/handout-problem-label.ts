import type { Locale, PartialLocalizedString } from '@/i18n/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import type { HandoutEnvironmentType } from './handout-content-types'
import type { HandoutEnvironmentTarget } from './handout-metadata-types'
import { findHandoutByContentId, resolveHandoutProblemRef } from './handout-problem-ref'

/**
 * What naming a handout problem takes beyond the problem itself: the site's handout content is read on the
 * client, so nothing that only knows the target can do it.
 */
export type HandoutProblemLabeller = {
  /** Names an environment's kind, e.g. "Problem" or "Theorem". */
  environmentLabels: Record<HandoutEnvironmentType, string>
  /** What to call a handout that is gone from the site, which the problems held against it outlive. */
  deletedHandoutLabel: string
  /** Which language to read the handouts in. */
  locale: Locale
}

/**
 * Which environment of a handout a problem is, as it reads.
 */
type HandoutEnvironmentLabel = {
  /** What it is called, e.g. "Problem 3". */
  label: string
  /** Its kind, which is what the label is coloured by. */
  type: HandoutEnvironmentType
}

/**
 * A handout problem as it is named on screen.
 */
export type HandoutProblemLabel = {
  /** The handout holding it, or what a handout gone from the site is called. */
  handoutTitle: string
  /** Whether that title is a real handout's: a problem can go from one the site still carries. */
  isHandoutOnSite: boolean
  /** Which environment of that handout it is; null once the problem is gone and nothing names it. */
  environment: HandoutEnvironmentLabel | null
}

/**
 * Names the handout with the given content id, reading it in the given language where it has one.
 *
 * @param handoutContentId - The handout's permanent content id.
 * @param locale - The language to name it in.
 *
 * @returns Its title, or null when the site no longer carries the handout at all.
 */
function findHandoutTitle(handoutContentId: string, locale: Locale): string | null {
  // The handout itself, by its permanent content id
  const handout = findHandoutByContentId(handoutContentId)

  // A problem outlives the handout it was held against
  if (handout === undefined) {
    return null
  }

  // A handout published in only some languages names itself only in those, so read the titles as the
  // partial map they really are
  const titles: PartialLocalizedString = handout.title

  // Its title in this language, falling back to whichever language does name it; a handout that names
  // itself in no language at all is indistinguishable from a missing one
  return (
    titles[locale] ?? SUPPORTED_LOCALES.map((candidate) => titles[candidate]).find(Boolean) ?? null
  )
}

/**
 * Names a handout problem in the reader's language.
 *
 * A problem held against handout content outlives it, and it can go in two steps: the environment can be
 * renamed or dropped from a handout that is still on the site, and the handout itself can go. Only the second
 * costs the reader the title, so the first keeps naming the handout it was in.
 *
 * @param target - The handout environment to name.
 * @param labeller - What naming it takes.
 *
 * @returns The problem as it reads.
 */
export function describeHandoutProblem(
  target: HandoutEnvironmentTarget,
  labeller: HandoutProblemLabeller
): HandoutProblemLabel {
  // Where in the handouts it sits, absent once either the problem or its whole handout is gone
  const problemRef = resolveHandoutProblemRef(target, labeller.locale)

  // Nothing places the problem any more, so all that is left to say is which handout held it
  if (problemRef === null) {
    // The handout it was in, still on the site whenever the problem alone went
    const remainingTitle = findHandoutTitle(target.handoutContentId, labeller.locale)

    // Its handout, or the standing name for one that is gone
    return {
      handoutTitle: remainingTitle ?? labeller.deletedHandoutLabel,
      isHandoutOnSite: remainingTitle !== null,
      environment: null,
    }
  }

  // The handout, and which of its environments this is
  return {
    handoutTitle: problemRef.handoutTitle,
    isHandoutOnSite: true,
    environment: {
      label: `${labeller.environmentLabels[problemRef.environmentType]} ${problemRef.environmentNumber}`,
      type: problemRef.environmentType,
    },
  }
}
