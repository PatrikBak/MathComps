import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the hosted competition endpoints.
 */
const COMPETITIONS_PATH = '/competitions'

/**
 * Builds the URL for reading every group a student can see.
 *
 * @returns The view URL.
 */
export function getHostedCompetitionsViewUrl(): string {
  // The competitions list endpoint
  return buildApiUrl(COMPETITIONS_PATH)
}

/**
 * Builds the URL for reading what an entry still needs of the student.
 *
 * @returns The readiness URL.
 */
export function getEntryReadinessUrl(): string {
  // The readiness endpoint
  return buildApiUrl(`${COMPETITIONS_PATH}/readiness`)
}

/**
 * Builds the URL for asking the page to stop naming the student's unfinished profile.
 *
 * @returns The dismissal URL.
 */
export function getDismissProfilePromptUrl(): string {
  // The readiness dismissal endpoint
  return buildApiUrl(`${COMPETITIONS_PATH}/readiness/dismissal`)
}

/**
 * Builds the URL for taking an entry into one competition.
 *
 * @param competitionId - Which competition is being entered.
 * @returns The entry URL.
 */
export function getEnterCompetitionUrl(competitionId: string): string {
  // The entry endpoint for the competition
  return buildApiUrl(`${COMPETITIONS_PATH}/${encodeURIComponent(competitionId)}/entry`)
}

/**
 * Builds the URL for giving an entry up to read the problems.
 *
 * @param competitionId - Which competition's entry is being given up.
 * @returns The forfeit URL.
 */
export function getForfeitCompetitionUrl(competitionId: string): string {
  // The forfeit endpoint for the competition
  return buildApiUrl(`${COMPETITIONS_PATH}/${encodeURIComponent(competitionId)}/forfeit`)
}

/**
 * Builds the URL for closing a running entry early.
 *
 * @param competitionId - Which competition's entry is being handed in.
 * @returns The hand-in URL.
 */
export function getFinishCompetitionUrl(competitionId: string): string {
  // The finish endpoint for the competition
  return buildApiUrl(`${COMPETITIONS_PATH}/${encodeURIComponent(competitionId)}/finish`)
}

/**
 * Builds the URL for reading one competition's problems.
 *
 * @param competitionId - Which competition's problems to read.
 * @returns The problems URL.
 */
export function getCompetitionProblemsUrl(competitionId: string): string {
  // The problems endpoint for the competition
  return buildApiUrl(`${COMPETITIONS_PATH}/${encodeURIComponent(competitionId)}/problems`)
}

/**
 * Builds the URL for what a student says about their own solution to one of a competition's problems, which
 * is the same address whether they are recording it or taking it back.
 *
 * @param competitionId - Which competition the problem belongs to.
 * @param problemId - Which problem the claim is about.
 * @returns The self-assessment URL.
 */
export function getProblemSelfAssessmentUrl(competitionId: string, problemId: string): string {
  // The assessment endpoint for the problem
  return buildApiUrl(
    `${COMPETITIONS_PATH}/${encodeURIComponent(competitionId)}/problems/${encodeURIComponent(problemId)}/assessment`
  )
}
