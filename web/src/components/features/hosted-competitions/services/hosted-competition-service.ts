import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type {
  EntryReadiness,
  HostedCompetitionEntry,
  HostedCompetitionProblem,
  HostedCompetitionsView,
  SpentEntry,
} from '../model/hosted-competition-types'
import {
  getCompetitionProblemsUrl,
  getDismissProfilePromptUrl,
  getEnterCompetitionUrl,
  getEntryReadinessUrl,
  getFinishCompetitionUrl,
  getForfeitCompetitionUrl,
  getHostedCompetitionsViewUrl,
  getProblemSelfAssessmentUrl,
} from './hosted-competition-api-urls'

/**
 * The backend for the competitions the site hosts itself: authenticated calls to the .NET API.
 */

/**
 * Reads every group a student can see, with whatever entry they hold in each competition.
 *
 * @param apiCall - The authenticated API caller.
 * @returns The competitions view.
 */
export function fetchHostedCompetitionsView(
  apiCall: ApiCaller
): Promise<ApiResult<HostedCompetitionsView>> {
  return apiCall<HostedCompetitionsView>(() => getHostedCompetitionsViewUrl())
}

/**
 * Reads whether the student has what an entry needs of them.
 *
 * @param apiCall - The authenticated API caller.
 * @returns The student's readiness.
 */
export function fetchEntryReadiness(apiCall: ApiCaller): Promise<ApiResult<EntryReadiness>> {
  return apiCall<EntryReadiness>(() => getEntryReadinessUrl())
}

/**
 * Takes the student's word that they do not want their unfinished profile named again.
 *
 * @param apiCall - The authenticated API caller.
 * @returns Nothing, once the answer is recorded.
 */
export function dismissProfilePrompt(apiCall: ApiCaller): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDismissProfilePromptUrl(), { method: 'POST' })
}

/**
 * Takes the student's entry into one competition: the clock starts and the problems it bought come back
 * with it.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition is being entered.
 * @returns The entry that was created and the set it opens.
 */
export function enterHostedCompetition(
  apiCall: ApiCaller,
  competitionId: string
): Promise<ApiResult<SpentEntry>> {
  return apiCall<SpentEntry>(() => getEnterCompetitionUrl(competitionId), { method: 'POST' })
}

/**
 * Gives the student's entry up: the problems open to them and no clock is ever started.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition's entry is being given up.
 * @returns The entry that was created and the set it opens.
 */
export function forfeitHostedCompetition(
  apiCall: ApiCaller,
  competitionId: string
): Promise<ApiResult<SpentEntry>> {
  return apiCall<SpentEntry>(() => getForfeitCompetitionUrl(competitionId), { method: 'POST' })
}

/**
 * Closes a running entry where the student says rather than where its clock does.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition's entry is being handed in.
 * @returns The entry as it now stands.
 */
export function finishHostedCompetition(
  apiCall: ApiCaller,
  competitionId: string
): Promise<ApiResult<HostedCompetitionEntry>> {
  return apiCall<HostedCompetitionEntry>(() => getFinishCompetitionUrl(competitionId), {
    method: 'POST',
  })
}

/**
 * Reads one competition's problem set, with whatever the student has said about each.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition's problems to read.
 * @returns The problems, in the order the competition sets them.
 */
export function fetchCompetitionProblems(
  apiCall: ApiCaller,
  competitionId: string
): Promise<ApiResult<HostedCompetitionProblem[]>> {
  return apiCall<HostedCompetitionProblem[]>(() => getCompetitionProblemsUrl(competitionId))
}

/**
 * Records what the student makes of their own solution to one problem, replacing what they said before.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition the problem belongs to.
 * @param problemId - Which problem the claim is about.
 * @param comment - What they say about the solution.
 * @returns Nothing, once the claim is recorded.
 */
export function setProblemSelfAssessment(
  apiCall: ApiCaller,
  competitionId: string,
  problemId: string,
  comment: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getProblemSelfAssessmentUrl(competitionId, problemId), {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  })
}

/**
 * Takes back what the student said about their own solution to one problem.
 *
 * @param apiCall - The authenticated API caller.
 * @param competitionId - Which competition the problem belongs to.
 * @param problemId - Which problem the claim was about.
 * @returns Nothing, once nothing of theirs stands against the problem.
 */
export function clearProblemSelfAssessment(
  apiCall: ApiCaller,
  competitionId: string,
  problemId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getProblemSelfAssessmentUrl(competitionId, problemId), {
    method: 'DELETE',
  })
}
