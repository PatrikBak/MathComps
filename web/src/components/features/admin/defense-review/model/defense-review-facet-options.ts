import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import {
  describeHandoutProblem,
  type HandoutProblemLabel,
  type HandoutProblemLabeller,
} from '@/components/features/handouts/handout-problem-label'
import type { FacetOption } from '@/components/shared/components/facets/model/facet-types'

import { encodeProblemKey } from './defense-review-filters'
import {
  type DefenseReviewProblemOption,
  type DefenseReviewPromptVersionOption,
  type DefenseReviewUserOption,
  describeReviewUser,
} from './defense-review-types'

/**
 * Turns the students into facet options.
 *
 * The address rides inside the label rather than beside it, since the label is also what the facet's search
 * reads, so either half finds the student.
 *
 * @param users - The students, as the backend counted them.
 * @param unnamedLabel - What to call a student the site holds neither a name nor an address for.
 *
 * @returns The options, ready for the facet.
 */
export function toUserFacetOptions(
  users: DefenseReviewUserOption[],
  unnamedLabel: string
): FacetOption[] {
  // One option per student, carrying whichever halves the site holds so the search reads them
  return users.map((option) => ({
    id: option.user.id,
    displayName:
      option.user.username === null || option.user.email === null
        ? describeReviewUser(option.user, unnamedLabel)
        : `${option.user.username} (${option.user.email})`,
    count: option.conversationCount,
  }))
}

/**
 * The section holding every problem whose handout is gone from the site. They share one, rather than keeping a
 * section each: their handouts are told apart only by a content id, so a section per handout is a run of
 * headings a reader cannot tell apart, all of them saying the same thing.
 */
const DELETED_HANDOUT_GROUP_KEY = 'deletedHandout'

/**
 * Which section a problem falls into: its handout, or the shared one every problem outliving its handout
 * lands in.
 *
 * @param target - The problem.
 * @param label - The problem as it reads.
 * @returns The section's key.
 */
function toProblemGroupKey(target: HandoutEnvironmentTarget, label: HandoutProblemLabel): string {
  // Nothing names the handout any more, so the problem joins the ones in the same position. It is the
  // handout going that costs the heading its words, not the problem: one dropped from a handout the site
  // still carries files under that handout, which is named and tells the reader something.
  if (!label.isHandoutOnSite) return DELETED_HANDOUT_GROUP_KEY

  // Otherwise it files under the handout it belongs to
  return target.handoutContentId
}

/**
 * The problem facet: its options, and what each of its sections is called.
 */
export type DefenseReviewProblemFacet = {
  /** One option per problem. */
  options: FacetOption[]
  /** What to call each section, keyed by the section's key. */
  sectionLabels: Record<string, string>
}

/**
 * Turns the problems into facet options, grouped under the handout they belong to.
 *
 * The backend can only name them by id: it ships no handout content and so cannot tell one problem from
 * another in any language. The labels are resolved here instead, and a problem whose handout has since gone
 * from the site keeps its option under a heading saying so rather than disappearing along with its
 * conversations.
 *
 * The section heading names the handout, so an option only names the problem. The handout is still there as
 * the option's fuller name, which is what the search reads and what the trigger shows once one is picked:
 * there are hundreds of options here, so the reader is typing rather than scrolling, and "Problem 3" on its
 * own belongs to every handout at once.
 *
 * The sections come out of the same pass as the options, since a section's heading and the options filed
 * under it are two readings of one labelling, and computing them apart is what lets them disagree.
 *
 * @param problems - The problems, as the backend counted them.
 * @param labeller - How to name them.
 * @returns The options and their section headings, as described by {@link DefenseReviewProblemFacet}.
 */
export function toProblemFacet(
  problems: DefenseReviewProblemOption[],
  labeller: HandoutProblemLabeller
): DefenseReviewProblemFacet {
  // What to call each section, filled in as the problems name the handouts they file under
  const sectionLabels: Record<string, string> = {}

  // One option per problem, each carrying the handout it files under
  const options = problems.map((option) => {
    // The problem as it reads: which handout, and which of its environments
    const label = describeHandoutProblem(option.target, labeller)

    // The section it falls into
    const groupKey = toProblemGroupKey(option.target, label)

    // What that section is called. The shared one names itself, since the problems landing in it come from
    // several handouts and letting whichever was labelled last name it heads them with one of the others.
    sectionLabels[groupKey] =
      groupKey === DELETED_HANDOUT_GROUP_KEY ? labeller.deletedHandoutLabel : label.handoutTitle

    // What to call it under the heading naming its handout; a problem gone from that handout falls back to
    // its own id, which the heading still narrows down
    const displayName =
      label.environment === null ? option.target.environmentId : label.environment.label

    // The option, keyed by the pair of ids since neither identifies a problem on its own
    return {
      id: encodeProblemKey(option.target),
      displayName,
      fullName: `${displayName} (${label.handoutTitle})`,
      count: option.conversationCount,
      groupKey,
    }
  })

  // The facet, both halves out of the one labelling
  return { options, sectionLabels }
}

/**
 * Turns the recorded examiner settings into facet options, newest first.
 *
 * The backend hands them over most recently used first, which is a different ordering: reverting the examiner
 * to an earlier configuration reuses that configuration's version key, so its group comes back to the top
 * while the label goes on naming the day it was first used. Ordered here by that same first use, so the
 * ordering and the labels say one thing.
 *
 * @param versions - The settings, as the backend counted them.
 * @param formatMoment - Renders the moment a version came into use, to the minute.
 * @returns The options, ready for the facet.
 */
export function toPromptVersionFacetOptions(
  versions: DefenseReviewPromptVersionOption[],
  formatMoment: (isoDate: string) => string
): FacetOption[] {
  // The versions, the most recently introduced leading
  const newestFirst = [...versions].sort(
    (first, second) =>
      new Date(second.firstSeenAt).getTime() - new Date(first.firstSeenAt).getTime()
  )

  // One option per version
  return newestFirst.map((option) => ({
    id: option.version,
    // When a version first ran is what identifies it to a reader, so it is the whole label: the key is a hash
    // and says nothing, and it was only ever there to separate two versions that a date alone read the same.
    // The time separates them, and two shipped inside one minute is not a thing that happens.
    displayName: formatMoment(option.firstSeenAt),
    count: option.conversationCount,
  }))
}
