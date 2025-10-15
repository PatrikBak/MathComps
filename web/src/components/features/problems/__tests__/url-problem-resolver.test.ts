import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Problem } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SingleProblemResult } from '../types/problem-library-types'
import { extractProblemId, hasProblemId, resolveUrlParameters } from '../utils/url-problem-resolver'

// Mock the entire module
vi.mock('../services/problem-service')

// Import after mocking to get the mocked version
import { getProblemBySlug } from '../services/problem-service'

const mockGetProblemBySlug = vi.mocked(getProblemBySlug)

describe('URL Problem Resolver', () => {
  const mockProblem: Problem = {
    slug: 'test-problem-slug',
    source: {
      competition: { displayName: 'IMO', slug: 'imo' },
      number: 1,
      round: { displayName: 'I', slug: 'i' },
      season: { displayName: '2023', slug: '2023' },
    },
    tags: [],
    authors: [],
    similarProblems: [],
    images: [],
  }

  const mockSingleProblemResult: SingleProblemResult = {
    problem: mockProblem,
    filters: {
      searchText: '',
      searchInSolution: false,
      seasons: [],
      problemNumbers: [],
      tags: [],
      tagLogic: 'or',
      authors: [],
      authorLogic: 'or',
      contestSelection: [],
    },
    options: {
      competitions: [],
      seasons: [],
      problemNumbers: [],
      tags: [],
      authors: [],
    } as FilterOptionsWithCounts,
  }

  const mockBaseOptions: FilterOptionsWithCounts = {
    competitions: [],
    seasons: [],
    problemNumbers: [],
    tags: [],
    authors: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveUrlParameters', () => {
    it('should resolve problem ID URL to redirect to filters', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=test-problem-slug')
      mockGetProblemBySlug.mockResolvedValue({
        isSuccess: true,
        value: mockSingleProblemResult,
      })

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('redirect_to_filters')
      expect(result.redirectUrl).toContain('/ulohy?')
      expect(result.redirectUrl).toContain('competitions=imo-i')
      expect(result.redirectUrl).toContain('problemNumbers=1')
      expect(result.redirectUrl).toContain('seasons=2023')
      expect(result.problem).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mockGetProblemBySlug).toHaveBeenCalledWith('test-problem-slug')
    })

    it('should handle problem not found error', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=nonexistent-problem')
      mockGetProblemBySlug.mockResolvedValue({
        isSuccess: false,
        error: {
          type: 'PROBLEM_NOT_FOUND',
          slug: 'nonexistent-problem',
          message: 'Problem not found',
        },
      })

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.problem).toBeUndefined()
      expect(result.filters.searchText).toBe('')
      expect(result.error).toContain('Problem with slug "nonexistent-problem" not found')
      expect(mockGetProblemBySlug).toHaveBeenCalledWith('nonexistent-problem')
    })

    it('should handle API fetch errors', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=error-problem')
      mockGetProblemBySlug.mockRejectedValue(new Error('Network error'))

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.problem).toBeUndefined()
      expect(result.error).toContain('Failed to fetch problem "error-problem": Network error')
    })

    it('should return error when problem ID is combined with other parameters', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=test-problem&competitions=imo&tags=algebra')

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.problem).toBeUndefined()
      expect(result.error).toContain(
        "Invalid URL: When 'id' parameter is present, no other parameters are allowed"
      )
      expect(result.error).toContain('competitions, tags')
      expect(mockGetProblemBySlug).not.toHaveBeenCalled()
    })

    it('should return error for single additional parameter with ID', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=test-problem&competitions=imo')

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.error).toContain(
        "Invalid URL: When 'id' parameter is present, no other parameters are allowed"
      )
      expect(result.error).toContain('competitions')
      expect(mockGetProblemBySlug).not.toHaveBeenCalled()
    })

    it('should return filters type when no problem ID is present', async () => {
      // Arrange
      const searchParams = new URLSearchParams('competitions=imo&tags=algebra')

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('filters')
      expect(result.problem).toBeUndefined()
      expect(result.filters.searchText).toBe('')
      expect(result.error).toBeUndefined()
      expect(mockGetProblemBySlug).not.toHaveBeenCalled()
    })

    it('should return filters type when URL is empty', async () => {
      // Arrange
      const searchParams = new URLSearchParams('')

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('filters')
      expect(result.problem).toBeUndefined()
      expect(mockGetProblemBySlug).not.toHaveBeenCalled()
    })
  })

  describe('hasProblemId', () => {
    it('should return true when id parameter exists and is not empty', () => {
      expect(hasProblemId(new URLSearchParams('id=test-slug'))).toBe(true)
      expect(hasProblemId(new URLSearchParams('id=test-slug&other=param'))).toBe(true)
    })

    it('should return false when id parameter is empty or missing', () => {
      expect(hasProblemId(new URLSearchParams(''))).toBe(false)
      expect(hasProblemId(new URLSearchParams('other=param'))).toBe(false)
      expect(hasProblemId(new URLSearchParams('id='))).toBe(false)
      expect(hasProblemId(new URLSearchParams('id=&other=param'))).toBe(false)
    })
  })

  describe('extractProblemId', () => {
    it('should extract valid problem IDs', () => {
      expect(extractProblemId(new URLSearchParams('id=test-slug'))).toBe('test-slug')
      expect(extractProblemId(new URLSearchParams('id=complex-problem-slug-123'))).toBe(
        'complex-problem-slug-123'
      )
      expect(extractProblemId(new URLSearchParams('id=test&other=param'))).toBe('test')
    })

    it('should return null for invalid or missing IDs', () => {
      expect(extractProblemId(new URLSearchParams(''))).toBe(null)
      expect(extractProblemId(new URLSearchParams('other=param'))).toBe(null)
      expect(extractProblemId(new URLSearchParams('id='))).toBe(null)
      expect(extractProblemId(new URLSearchParams('id=   '))).toBe(null)
    })

    it('should handle whitespace trimming', () => {
      expect(extractProblemId(new URLSearchParams('id=  test-slug  '))).toBe('test-slug')
      expect(extractProblemId(new URLSearchParams('id=%20test-slug%20'))).toBe('test-slug')
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in problem slugs', async () => {
      // Arrange
      const specialSlug = 'problem-with-special-chars-äöü'
      const searchParams = new URLSearchParams(`id=${encodeURIComponent(specialSlug)}`)
      mockGetProblemBySlug.mockResolvedValue({
        isSuccess: true,
        value: mockSingleProblemResult,
      })

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('redirect_to_filters')
      expect(result.redirectUrl).toContain('/ulohy?')
      expect(mockGetProblemBySlug).toHaveBeenCalledWith(specialSlug)
    })

    it('should handle very long problem slugs', async () => {
      // Arrange
      const longSlug = 'a'.repeat(500)
      const searchParams = new URLSearchParams(`id=${longSlug}`)
      mockGetProblemBySlug.mockResolvedValue({
        isSuccess: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Slug too long',
          field: 'slug',
        },
      })

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.error).toContain('Problem with slug')
      expect(mockGetProblemBySlug).toHaveBeenCalledWith(longSlug)
    })

    it('should handle non-Error thrown objects', async () => {
      // Arrange
      const searchParams = new URLSearchParams('id=test-problem')
      mockGetProblemBySlug.mockRejectedValue('String error')

      // Act
      const result = await resolveUrlParameters({
        searchParams,
        baseOptions: mockBaseOptions,
      })

      // Assert
      expect(result.type).toBe('error')
      expect(result.error).toContain('Unknown error')
    })
  })
})
