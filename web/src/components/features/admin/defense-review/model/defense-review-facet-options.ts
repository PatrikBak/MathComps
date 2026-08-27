import {
  describeHandoutProblem,
  type HandoutProblemLabeller,
} from '@/components/features/handouts/handout-problem-label'
import { describeProblemRef } from '@/components/features/problems/problem-ref-label'
import type { FacetOption } from '@/components/shared/components/facets/model/facet-types'

import { encodeProblemKey } from './defense-review-filters'
import {
  type DefenseReviewHandoutTarget,
  type DefenseReviewProblemOption,
  type DefenseReviewProblemTarget,
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
const DELETED_HANDOUT_SECTION_KEY = 'deletedHandout'

/**
 * Sits in front of a section's own address, so a handout's content id and a competition's path can't land on
 * one section between them.
 */
const SECTION_KEY_KINDS = { handout: 'handout', competition: 'competition' } as const

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
 * One problem as the facet reads it: which section it files under, what that section is called, and how the
 * option itself reads.
 */
type ProblemFacetEntry = {
  /** The key of the section it files under. */
  sectionKey: string
  /** What that section is called. */
  sectionLabel: string
  /** What to call the option under that heading, e.g. "Problem 3". */
  displayName: string
  /** Its fuller name, which the facet's search reads and its trigger shows once one is picked. */
  fullName: string
}

/**
 * Reads a handout problem as the facet holds it.
 *
 * The heading names the handout, so the option only names the problem. The handout is still there as the
 * option's fuller name: there are hundreds of options here, so the reader is typing rather than scrolling, and
 * "Problem 3" on its own belongs to every handout at once.
 *
 * @param target - The problem.
 * @param labeller - How to name it.
 *
 * @returns The problem as the facet reads it.
 */
function readHandoutProblem(
  target: DefenseReviewHandoutTarget,
  labeller: HandoutProblemLabeller
): ProblemFacetEntry {
  // The problem as it reads: which handout, and which of its environments
  const label = describeHandoutProblem(target, labeller)

  // Nothing names the handout any more, so the problem joins the ones in the same position. It is the
  // handout going that costs the heading its words, not the problem: one dropped from a handout the site
  // still carries files under that handout, which is named and tells the reader something.
  const sectionKey = label.isHandoutOnSite
    ? [SECTION_KEY_KINDS.handout, target.handoutContentId].join(':')
    : DELETED_HANDOUT_SECTION_KEY

  // What to call it under the heading naming its handout; a problem gone from that handout falls back to
  // its own id, which the heading still narrows down
  const displayName = label.environment === null ? target.environmentId : label.environment.label

  // What heads the section: its handout, or the wording standing in for the ones that have gone, since
  // letting whichever of those was labelled last name it heads them with one of the others
  const sectionLabel = label.isHandoutOnSite ? label.handoutTitle : labeller.deletedHandoutLabel

  // The problem as the facet holds it
  return {
    sectionKey,
    sectionLabel,
    displayName,
    fullName: `${displayName} (${label.handoutTitle})`,
  }
}

/**
 * Reads an archive problem as the facet holds it.
 *
 * @param target - The problem.
 * @param problemWord - What this surface calls a problem, e.g. "Problem".
 *
 * @returns The problem as the facet reads it.
 */
function readArchiveProblem(
  target: DefenseReviewProblemTarget,
  problemWord: string
): ProblemFacetEntry {
  // The problem as it reads: where the competition sits, which run of it, and which problem of that
  const label = describeProblemRef(target.source, problemWord)

  // It files under the competition it was set in, which the last entry of the chain names
  const competitionPath = target.source.competition.at(-1)?.slug ?? target.slug

  // The heading spells the whole chain out, since it is what the reader is searching by
  const sectionLabel = [...label.context, label.edition].join(' ')

  // The season addresses the section along with the competition, since a competition runs again every year
  const sectionKey = [SECTION_KEY_KINDS.competition, competitionPath, target.source.startYear].join(
    ':'
  )

  // The problem as the facet holds it
  return {
    sectionKey,
    sectionLabel,
    displayName: label.problem,
    fullName: `${label.problem} (${sectionLabel})`,
  }
}

/**
 * Turns the problems into facet options, grouped under whatever holds them.
 *
 * A handout problem is named here, since the site's handout content is read on the client and the backend can
 * only address it by id. An archive problem arrives already named, since the taxonomy is not read here.
 *
 * The sections come out of the same pass as the options, since a section's heading and the options filed
 * under it are two readings of one labelling, and computing them apart is what lets them disagree.
 *
 * @param problems - The problems, as the backend counted them.
 * @param labeller - How to name the handout ones.
 * @param problemWord - What this surface calls a problem, e.g. "Problem".
 *
 * @returns The options and their section headings, as described by {@link DefenseReviewProblemFacet}.
 */
export function toProblemFacet(
  problems: DefenseReviewProblemOption[],
  labeller: HandoutProblemLabeller,
  problemWord: string
): DefenseReviewProblemFacet {
  // What to call each section, filled in as the problems name what they file under
  const sectionLabels: Record<string, string> = {}

  // One option per problem, each carrying the section it files under
  const options = problems.map((option) => {
    // The problem as the facet reads it, whichever kind of problem it is
    const entry =
      option.target.kind === 'handout'
        ? readHandoutProblem(option.target, labeller)
        : readArchiveProblem(option.target, problemWord)

    // What that section is called
    sectionLabels[entry.sectionKey] = entry.sectionLabel

    // The option, keyed the way the reader's selection is read back
    return {
      id: encodeProblemKey(option.target),
      displayName: entry.displayName,
      fullName: entry.fullName,
      count: option.conversationCount,
      groupKey: entry.sectionKey,
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
