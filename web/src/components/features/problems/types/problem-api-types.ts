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
  tagType?: TagType
}

export type TagType = 'Area' | 'Type' | 'Goal' | 'Technique'

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
  statementMarkdown: string
  similarityScore: number
}

export type Problem = {
  slug: string
  statementMarkdown: string
  solutionLink?: string | null
  source: ProblemSource
  tags: TagDto[]
  authors: LabeledSlug[]
  similarProblems: SimilarProblem[]
  liked: boolean
  marked: boolean
  likeCount: number
  commentCount: number
  listContentIds: string[]
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

type CategoryFilterOption = {
  categoryData: FacetOption
  roundData: FacetOption[]
}

export type CompetitionFilterOption = {
  competitionData: FacetOption
  categoryData: CategoryFilterOption[]
  roundData: FacetOption[]
}
