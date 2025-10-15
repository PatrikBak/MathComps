import { getProblemBySlug } from '@/components/features/problems/services/problem-service'
import { ROUTES } from '@/constants/routes'

import type { Problem } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { createDefaultFilters } from './url-initialization'

/**
 * Configuration for URL-based problem resolution.
 */
interface UrlProblemResolverConfig {
  searchParams: URLSearchParams
  baseOptions: FilterOptionsWithCounts
}

/**
 * Result of URL problem resolution.
 */
interface UrlProblemResolverResult {
  type: 'problem' | 'filters' | 'error' | 'redirect_to_filters'
  problem?: Problem
  filters: SearchFiltersState
  error?: string
  redirectUrl?: string
}

/**
 * Resolves URL parameters to determine if we're looking for a specific problem
 * or applying filters. This is the main entry point for URL-based navigation.
 *
 * @param config - The configuration object containing search params and base options
 * @returns Promise with the resolution result
 */
export async function resolveUrlParameters(
  config: UrlProblemResolverConfig
): Promise<UrlProblemResolverResult> {
  const { searchParams } = config

  // Check if there's a problem ID in the URL
  const problemId = searchParams.get('id')

  if (problemId) {
    // When ID is present, NO other parameters are allowed
    const allParams = Array.from(searchParams.keys())
    const hasOtherParams = allParams.some((key) => key !== 'id')

    if (hasOtherParams) {
      return {
        type: 'error',
        filters: createDefaultFilters(),
        error: `Invalid URL: When 'id' parameter is present, no other parameters are allowed. Found: ${allParams.filter((key) => key !== 'id').join(', ')}`,
      }
    }

    // Handle specific problem request - fetch from backend and convert to URL redirect
    try {
      const problemResult = await getProblemBySlug(problemId)

      if (problemResult.isSuccess) {
        // Extract filter parameters from the backend response
        const problem = problemResult.value.problem
        const source = problem.source

        if (!source) {
          return {
            type: 'error',
            filters: createDefaultFilters(),
            error: `Problem "${problemId}" has no source information`,
          }
        }

        // Create URL parameters that match what the backend used to filter
        const urlParams = new URLSearchParams()

        // Add season (year)
        if (source.season?.slug) {
          urlParams.set('seasons', source.season.slug)
        }

        // Add competition selection (competition-category-round format)
        const selectionParts = [source.competition.slug]
        if (source.category?.slug) {
          selectionParts.push(source.category.slug)
        }
        if (source.round?.slug) {
          selectionParts.push(source.round.slug)
        }
        urlParams.set('competitions', selectionParts.join('-'))

        // Add problem number
        if (source.number) {
          urlParams.set('problemNumbers', source.number.toString())
        }

        // Return special type that indicates we should redirect to URL-based filtering
        return {
          type: 'redirect_to_filters',
          filters: createDefaultFilters(),
          redirectUrl: `${ROUTES.PROBLEMS}?${urlParams.toString()}`,
        }
      } else {
        return {
          type: 'error',
          filters: createDefaultFilters(),
          error: `Problem with slug "${problemId}" not found: ${problemResult.error}`,
        }
      }
    } catch (error) {
      return {
        type: 'error',
        filters: createDefaultFilters(),
        error: `Failed to fetch problem "${problemId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  // No problem ID, so this is a regular filter-based search
  // Return null to indicate that regular URL filter initialization should proceed
  return {
    type: 'filters',
    filters: createDefaultFilters(), // Will be overridden by regular URL initialization
  }
}

/**
 * Checks if the URL contains a problem ID parameter.
 * Useful for quick detection without full resolution.
 */
export function hasProblemId(searchParams: URLSearchParams): boolean {
  return searchParams.has('id') && searchParams.get('id') !== null && searchParams.get('id') !== ''
}

/**
 * Extracts the problem ID from URL parameters.
 * Returns null if no valid problem ID is found.
 */
export function extractProblemId(searchParams: URLSearchParams): string | null {
  const problemId = searchParams.get('id')
  return problemId && problemId.trim() !== '' ? problemId.trim() : null
}
