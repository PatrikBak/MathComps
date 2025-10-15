// Types that match backend API DTOs exactly
// These should be kept in sync with the C# backend DTOs

export type LabeledSlug = {
  slug: string
  displayName: string
  fullName?: string
}

export type FacetOption = {
  slug: string
  displayName: string
  fullName?: string
  count: number
}

export type TagType = 'Area' | 'Type' | 'Technique'

export type TagDto = {
  slug: string
  displayName: string
  tagType: TagType
}

type LogicToggle = 'or' | 'and'

type ProblemSource = {
  season: LabeledSlug
  competition: LabeledSlug
  round?: LabeledSlug | null
  category?: LabeledSlug | null
  number: number
}

export type SimilarProblem = {
  slug: string
  source: ProblemSource
  statement: string
  similarityScore: number
  images: ProblemImage[]
}

export type ProblemImage = {
  contentId: string
  width: string
  height: string
  scale: number
}

export type Problem = {
  slug: string
  statementParsed?: string
  solutionLink?: string | null
  source: ProblemSource
  tags: TagDto[]
  authors: LabeledSlug[]
  similarProblems: SimilarProblem[]
  images: ProblemImage[]
}

export type FilterParameters = {
  searchText: string
  searchInSolution: boolean
  olympiadYears: number[]
  contests: ContestSelection[]
  problemNumbers: number[]
  tagSlugs: string[]
  tagLogic: LogicToggle
  authorSlugs: string[]
  authorLogic: LogicToggle
}

type ContestSelection = {
  competitionSlug: string
  categorySlug?: string
  roundSlug?: string
}

export type CategoryFilterOption = {
  categoryData: FacetOption
  roundData: FacetOption[]
}

export type CompetitionFilterOption = {
  competitionData: FacetOption
  categoryData: CategoryFilterOption[]
  roundData: FacetOption[]
}
