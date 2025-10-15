using MathComps.Domain.ApiDtos.Helpers;
using MathComps.Domain.ApiDtos.ProblemQuery;
using MathComps.Domain.ApiDtos.SearchBar;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Immutable;
using System.Globalization;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// EF Core-backed implementation of problem retrieval and filtering aligned to API DTOs.
/// Provides paginated problem search with faceted filtering capabilities including competitions,
/// seasons, tags, authors, and full-text search with similarity matching.
/// </summary>
/// <param name="dbContext">Database context for accessing problem entities and related data</param>
/// <param name="paginationOptions">Configuration options for pagination limits and defaults</param>
/// <param name="similarityOptions">Configuration options for similarity scoring thresholds and limits</param>
public class ProblemFilterService(
    MathCompsDbContext dbContext,
    IOptionsSnapshot<PaginationOptions> paginationOptions,
    IOptionsSnapshot<SimilarityOptions> similarityOptions) : IProblemFilterService
{

    /// <inheritdoc/>
    public async Task<FilterResult> FilterAsync(FilterQuery query)
    {
        // Convenient deconstruct
        var (parameters, pageSize, pageNumber) = query;

        // Positive page numbers indexed from 1
        if (pageNumber <= 0)
            throw new ArgumentException($"Page number must be greater than 0, but was {pageNumber}");

        // Positive page sizes
        if (pageSize <= 0)
            throw new ArgumentException($"Page size must be greater than 0, but was {pageSize}");

        // Not too large page sizes
        if (pageSize > paginationOptions.Value.MaxPageSize)
            throw new ArgumentException($"Page size {pageSize} exceeds maximum allowed {paginationOptions.Value.MaxPageSize}");

        // Apply user-specified filters to narrow down the result set
        var filteredQuery = ApplyFilters(dbContext.Problems, query.Parameters);

        // Apply consistent sorting for predictable pagination results
        var sortedQuery = filteredQuery.OrderByDefaultProblemSort();

        // Get total count (this still works on the IQueryable<Problem>)
        var totalCount = await sortedQuery.CountAsync();

        // Build a query...
        var dtoQuery = sortedQuery
            // Split query to avoid Cartesian explosion when accessing multiple collections
            .AsSplitQuery()
            // Which projects results to DTOs directly in the database query
            .Select(problem => new ProblemDto(
                problem.Slug,
                problem.StatementParsed,
                // Problem Source
                new ProblemSource(
                    // Season
                    new LabeledSlug(
                        problem.RoundInstance.Season.EditionNumber.ToString(),
                        problem.RoundInstance.Season.EditionLabel,
                        null
                    ),
                    // Competition
                    new LabeledSlug(
                        problem.RoundInstance.Round.Competition.Slug,
                        problem.RoundInstance.Round.Competition.DisplayName,
                        problem.RoundInstance.Round.Competition.FullName
                    ),
                    // Round (may be null)
                    new LabeledSlug(
                        problem.RoundInstance.Round.Slug,
                        problem.RoundInstance.Round.DisplayName,
                        problem.RoundInstance.Round.FullName
                    ),
                    // Category (may be null)
                    problem.RoundInstance.Round.Category == null ? null
                        : new LabeledSlug(
                            problem.RoundInstance.Round.Category.Slug,
                            problem.RoundInstance.Round.Category.Name,
                            null
                        ),
                    problem.Number
                ),
                // Tags
                problem.Tags.Select(tag => new TagDto(tag.Slug, tag.Name, tag.TagType)).ToImmutableList(),
                // Authors
                problem.ProblemAuthors
                    // Maintain author order by ordinal
                    .OrderBy(problemAuthor => problemAuthor.Ordinal)
                    // Extract author
                    .Select(problemAuthor => new LabeledSlug(
                        problemAuthor.Author.Slug,
                        problemAuthor.Author.Name,
                        null
                    ))
                    // Evaluate 
                    .ToImmutableList(),
                // Similar Problems 
                problem.SimilarProblems
                    // Only similar enough problems
                    .Where(similarProblem => similarProblem.SimilarityScore >= similarityOptions.Value.MinSimilarityScore)
                    // Most similar problems first
                    .OrderByDescending(similarProblem => similarProblem.SimilarityScore)
                    // Respect configured limit
                    .Take(similarityOptions.Value.MaxSimilarProblems)
                    // Create DTOs for each similar problem
                    .Select(similarProblem => new SimilarProblemDto(
                        similarProblem.SimilarProblem.Slug,
                        new ProblemSource(
                            // Season
                            new LabeledSlug(
                                similarProblem.SimilarProblem.RoundInstance.Season.EditionNumber.ToString(),
                                similarProblem.SimilarProblem.RoundInstance.Season.EditionLabel,
                                null
                            ),
                            // Competition
                            new LabeledSlug(
                                similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug,
                                similarProblem.SimilarProblem.RoundInstance.Round.Competition.DisplayName,
                                similarProblem.SimilarProblem.RoundInstance.Round.Competition.FullName
                            ),
                            // Round
                            new LabeledSlug(
                                similarProblem.SimilarProblem.RoundInstance.Round.Slug,
                                similarProblem.SimilarProblem.RoundInstance.Round.DisplayName,
                                similarProblem.SimilarProblem.RoundInstance.Round.FullName
                            ),
                            // Category (may be null)
                            similarProblem.SimilarProblem.RoundInstance.Round.Category == null ? null
                                : new LabeledSlug(
                                    similarProblem.SimilarProblem.RoundInstance.Round.Category.Slug,
                                    similarProblem.SimilarProblem.RoundInstance.Round.Category.Name,
                                    null
                                ),
                            similarProblem.SimilarProblem.Number
                        ),
                        similarProblem.SimilarProblem.StatementParsed,
                        similarProblem.SimilarityScore,
                        similarProblem.SimilarProblem.Images
                            // Project to ProblemImageDto
                            .Select(image => new ProblemImageDto(
                                image.ContentId,
                                image.Width,
                                image.Height,
                                image.Scale
                            ))
                            // Evaluate
                            .ToImmutableList()
                    ))
                    // Evaluate
                    .ToImmutableList(),
                // Images
                problem.Images
                    // Project to ProblemImageDto
                    .Select(image => new ProblemImageDto(image.ContentId, image.Width, image.Height, image.Scale))
                    // Evaluate
                    .ToImmutableList(),
                problem.SolutionLink
            ));

        // Retrieve the current page of DTOs
        var currentPageDtos = await dtoQuery
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        // Create paginated result set
        var pagedResults = new PagedList<ProblemDto>([.. currentPageDtos], pageNumber, pageSize, totalCount);

        // Build search bar options only for the first page to avoid unnecessary computation
        var searchBarOptions = pageNumber != 1 ? null :
             // Build search bar options with disjunctive faceting
             await BuildSearchOptionsAsync(dbContext.Problems, query.Parameters);

        // Return the complete filter result
        return new FilterResult(pagedResults, searchBarOptions);
    }

    /// <summary>
    /// Applies all active filters to the base query based on user's selections.
    /// </summary>
    /// <param name="problems">Base queryable to apply filters to</param>
    /// <param name="parameters">Filter parameters containing user selections and search criteria</param>
    /// <returns>Filtered queryable with all applicable conditions applied</returns>
    private static IQueryable<Problem> ApplyFilters(IQueryable<Problem> problems, FilterParameters parameters)
    {
        // If years are specified..
        if (parameters.OlympiadYears is { Count: > 0 })
        {
            // Filter by those seasons
            problems = problems.Where(problem =>
                parameters.OlympiadYears.Contains(problem.RoundInstance.Season.EditionNumber)
            );
        }

        // If contests are specified..
        if (parameters.Contests is { Count: > 0 })
        {
            // Categorize selections by specificity level
            var competitionOnlySelections = new List<string>();
            var categoryLevelSelections = new List<(string CompetitionSlug, string CategorySlug)>();
            var roundLevelSelections = new List<(string CompetitionSlug, string? CategorySlug, string RoundSlug)>();

            // Handle each contest selection
            foreach (var (competitionSlug, categorySlug, roundSlug) in parameters.Contests)
            {
                // Most specific: round selection (may include category)
                if (roundSlug is not null)
                    roundLevelSelections.Add((competitionSlug, categorySlug, roundSlug));

                // Medium specificity: category selection within competition
                else if (categorySlug is not null)
                    categoryLevelSelections.Add((competitionSlug, categorySlug));

                // Least specific: entire competition selection
                else competitionOnlySelections.Add(competitionSlug);
            }

            // Build dynamic OR expression combining all selection levels
            // Start with false predicate to build OR conditions
            var combinedSelectionPredicate = PredicateBuilder.False<Problem>();

            // If any competition-only selections...
            if (competitionOnlySelections.Count > 0)
            {
                // Include them...
                combinedSelectionPredicate = combinedSelectionPredicate.Or(problem =>
                    competitionOnlySelections.Contains(problem.RoundInstance.Round.Competition.Slug));
            }

            // If any category-level selections..
            foreach (var (competitionSlug, categorySlug) in categoryLevelSelections)
            {
                // Include them...
                combinedSelectionPredicate = combinedSelectionPredicate.Or(problem =>
                    problem.RoundInstance.Round.Competition.Slug == competitionSlug &&
                    problem.RoundInstance.Round.Category!.Slug == categorySlug);
            }

            // Add any round-level selections
            foreach (var (competitionSlug, categorySlug, roundSlug) in roundLevelSelections)
            {
                // Include them...
                combinedSelectionPredicate = combinedSelectionPredicate.Or(problem =>
                    problem.RoundInstance.Round.Competition.Slug == competitionSlug &&
                    problem.RoundInstance.Round.Category!.Slug == categorySlug &&
                    problem.RoundInstance.Round.Slug == roundSlug);
            }

            // Apply the combined OR filter to the query
            problems = problems.Where(combinedSelectionPredicate);
        }

        // If specific problem numbers are given...
        if (parameters.ProblemNumbers is { Count: > 0 })
        {
            // Filter by those numbers
            problems = problems.Where(problem => parameters.ProblemNumbers.Contains(problem.Number));
        }

        // If tags are specified...
        if (parameters.TagSlugs is { Count: > 0 })
        {
            // Handle all logic values
            switch (parameters.TagLogic)
            {
                case LogicToggle.Or:

                    // We want any tags
                    problems = problems.Where(problem =>
                        problem.Tags.Any(tag => parameters.TagSlugs.Contains(tag.Slug)));

                    break;

                // We want all tags
                case LogicToggle.And:

                    // We want all tags
                    foreach (var tagSlug in parameters.TagSlugs)
                    {
                        // Each iteration adds one more required tag
                        problems = problems.Where(problem =>
                            problem.Tags.Any(tag => tag.Slug == tagSlug));
                    }

                    break;

                // Sad
                default:
                    throw new ArgumentOutOfRangeException(nameof(parameters.TagLogic), parameters.TagLogic, "Invalid tag logic option");
            }
        }

        // If any authors
        if (parameters.AuthorSlugs is { Count: > 0 })
        {
            // Handle all logic values
            switch (parameters.AuthorLogic)
            {
                case LogicToggle.Or:

                    // We want any author
                    problems = problems.Where(problem =>
                        problem.ProblemAuthors.Any(problemAuthor => parameters.AuthorSlugs.Contains(problemAuthor.Author.Slug)));

                    break;

                // We want all authors
                case LogicToggle.And:

                    // We want all authors
                    foreach (var authorSlug in parameters.AuthorSlugs)
                    {
                        // Each iteration adds one more required author
                        problems = problems.Where(problem =>
                            problem.ProblemAuthors.Any(problemAuthor => problemAuthor.Author.Slug == authorSlug));
                    }

                    break;

                // Sad
                default:
                    throw new ArgumentOutOfRangeException(nameof(parameters.TagLogic), parameters.TagLogic, "Invalid tag logic option");
            }
        }

        // Apply full-text search with accent-insensitive matching
        if (!string.IsNullOrWhiteSpace(parameters.SearchText))
        {
            // Normalize search term by removing accents for consistent matching
            // This handles cases like "café" matching "cafe" in the database
            var normalizedSearchTerm = $"%{parameters.SearchText.RemoveAccents()}%";

            // Do the search
            problems = problems.Where(problem =>
                // Search in problem statement (always included)
                EF.Functions.ILike(PostgresDbFunctions.Unaccent(problem.Statement), normalizedSearchTerm) ||
                // If we should search in solution and the problem has some...
                (parameters.SearchInSolution && problem.Solution != null &&
                    // Search there too
                    EF.Functions.ILike(PostgresDbFunctions.Unaccent(problem.Solution), normalizedSearchTerm)));
        }

        // The query is fully built
        return problems;
    }

    /// <summary>
    /// Builds search bar facet options with accurate counts using disjunctive faceting.
    /// Each facet shows counts based on other active filters while ignoring its own selections,
    /// providing users with meaningful "available options" even when filters are active.
    /// </summary>
    /// <param name="baseQuery">Base queryable with all necessary includes</param>
    /// <param name="parameters">Current filter parameters to exclude from facet calculations</param>
    /// <returns>Complete search bar options with facet counts and metadata</returns>
    private static async Task<SearchBarOptions> BuildSearchOptionsAsync(
        IQueryable<Problem> baseQuery,
        FilterParameters parameters)
    {
        // Create facet-specific scopes by excluding each facet's own selections
        // This ensures counts reflect available options rather than current selections
        var seasonsScope = ApplyFilters(baseQuery, parameters with { OlympiadYears = [] });
        var problemNumbersScope = ApplyFilters(baseQuery, parameters with { ProblemNumbers = [] });
        var competitionsAndRoundsScope = ApplyFilters(baseQuery, parameters with { Contests = [] });
        var tagsScope = ApplyFilters(baseQuery, parameters with { TagSlugs = [] });
        var authorsScope = ApplyFilters(baseQuery, parameters with { AuthorSlugs = [] });

        // Build season facet options with problem counts
        var seasonGroups = (await seasonsScope
            // Extract season info for grouping
            .Select(problem => new
            {
                problem.RoundInstance.Season.EditionNumber,
                problem.RoundInstance.Season.EditionLabel
            })
            // Group by unique seasons
            .GroupBy(season => new { season.EditionNumber, season.EditionLabel })
            // Project to intermediate structure with counts
            .Select(seasonGroup => new
            {
                seasonGroup.Key.EditionLabel,
                seasonGroup.Key.EditionNumber,
                Count = seasonGroup.Count()
            })
            // Sort seasons by edition number descending (most recent first)
            .OrderByDescending(seasonGroup => seasonGroup.EditionNumber)
            // Execute the query to get raw data
            .ToListAsync())
            // In-memory projection to FacetOption after query execution
            .Select(seasonGroup => new FacetOption(
                seasonGroup.EditionNumber.ToString(CultureInfo.InvariantCulture),
                seasonGroup.EditionLabel,
                FullName: null,
                seasonGroup.Count))
            // In-memory collection
            .ToList();

        // Build tag facet options sorted by popularity then alphabetically
        var tagGroups = await tagsScope
            // Extract tags for grouping
            .SelectMany(problem => problem.Tags)
            // Group by unique tag (name + slug)
            .GroupBy(tag => new { tag.Name, tag.Slug })
            // Project to intermediate structure with counts
            .Select(tagGroup => new
            {
                tagGroup.Key.Name,
                tagGroup.Key.Slug,
                Count = tagGroup.Count()
            })
            // Most popular tags first
            .OrderByDescending(tag => tag.Count)
            // Then alphabetical
            .ThenBy(tag => tag.Name)
            // Project to FacetOption
            .Select(tag => new FacetOption(tag.Slug, tag.Name, tag.Name, tag.Count))
            // Execute the query
            .ToListAsync();

        // Build author facet options sorted by problem count then alphabetically
        var authorGroups = await authorsScope
            // Extract authors for grouping
            .SelectMany(problem => problem.ProblemAuthors.Select(problemAuthor => problemAuthor.Author))
            // Group by unique author (name + slug)
            .GroupBy(author => new { author.Name, author.Slug })
            // Project to intermediate structure with counts
            .Select(authorGroup => new
            {
                authorGroup.Key.Name,
                authorGroup.Key.Slug,
                Count = authorGroup.Count()
            })
            // Most prolific authors first
            .OrderByDescending(author => author.Count)
            // Then alphabetical
            .ThenBy(author => author.Name)
            // Project to FacetOption
            .Select(author => new FacetOption(author.Slug, author.Name, author.Name, author.Count))
            // Execute the query
            .ToListAsync();

        // Build hierarchical competition structure with categories and rounds
        var competitionData = await competitionsAndRoundsScope
            // Extract competition, category, and round info for grouping
            .GroupBy(problem => new
            {
                CompetitionName = problem.RoundInstance!.Round.Competition.DisplayName,
                CompetitionFullName = problem.RoundInstance!.Round.Competition.FullName,
                CompetitionSlug = problem.RoundInstance!.Round.Competition.Slug,
                CompetitionSortOrder = problem.RoundInstance!.Round.Competition.SortOrder,
                CategoryName = problem.RoundInstance!.Round.Category != null ? problem.RoundInstance!.Round.Category.Name : null,
                CategorySlug = problem.RoundInstance!.Round.Category != null ? problem.RoundInstance!.Round.Category.Slug : null,
                CategorySortOrder = problem.RoundInstance!.Round.Category != null ? problem.RoundInstance!.Round.Category.SortOrder : (int?)null,
                RoundName = problem.RoundInstance!.Round.DisplayName,
                RoundFullName = problem.RoundInstance!.Round.FullName,
                RoundSlug = problem.RoundInstance!.Round.Slug,
                RoundSortOrder = problem.RoundInstance!.Round.SortOrder,
                problem.RoundInstance!.Round.IsDefault,
            })
            // Project to intermediate structure with counts
            .Select(competitionGroup => new
            {
                competitionGroup.Key.CompetitionName,
                competitionGroup.Key.CompetitionFullName,
                competitionGroup.Key.CompetitionSlug,
                competitionGroup.Key.CompetitionSortOrder,
                competitionGroup.Key.CategoryName,
                competitionGroup.Key.CategorySlug,
                competitionGroup.Key.CategorySortOrder,
                competitionGroup.Key.RoundName,
                competitionGroup.Key.RoundFullName,
                competitionGroup.Key.RoundSlug,
                competitionGroup.Key.RoundSortOrder,
                competitionGroup.Key.IsDefault,
                Count = competitionGroup.Count(),
            })
            // Execute the query
            .ToListAsync();

        // Organize competition data into hierarchical structure
        var competitions = competitionData
            // Group by competition first
            .GroupBy(competitionData => new
            {
                competitionData.CompetitionName,
                competitionData.CompetitionFullName,
                competitionData.CompetitionSlug,
                competitionData.CompetitionSortOrder
            })
            // Sort competitions by predefined sort order
            .OrderBy(competitionGroup => competitionGroup.Key.CompetitionSortOrder)
            // Project to CompetitionFilterOption with nested categories and rounds
            .Select(competitionGroup =>
            {
                // Group rounds by category within this competition
                var roundsByCategory = competitionGroup
                    // Only consider rounds with categories for this grouping
                    .Where(roundData => roundData.CategoryName != null)
                    // Group by category
                    .GroupBy(roundData => new
                    {
                        roundData.CategoryName,
                        roundData.CategorySlug,
                        roundData.CategorySortOrder
                    })
                    // Sort categories by predefined sort order
                    .OrderBy(categoryGroup => categoryGroup.Key.CategorySortOrder)
                    // Project to CategoryFilterOption with nested rounds
                    .Select(categoryGroup => new CategoryFilterOption(
                        // Category option with aggregated count
                        new FacetOption(
                            categoryGroup.Key.CategorySlug!,
                            categoryGroup.Key.CategoryName!,
                            FullName: null,
                            categoryGroup.Sum(roundData => roundData.Count)
                        ),
                        // Rounds within this category
                        [.. categoryGroup
                            // Sort rounds by predefined sort order
                            .OrderBy(roundData => roundData.RoundSortOrder)
                            // Project to FacetOption
                            .Select(roundData => new FacetOption(
                                roundData.RoundSlug,
                                roundData.RoundName,
                                roundData.RoundFullName,
                                roundData.Count)),
                        ]
                    ))
                    // In-memory collection
                    .ToImmutableList();

                // Handle rounds without categories (direct competition rounds)
                var roundsWithoutCategory = competitionGroup
                    // Only consider rounds without categories and exclude default rounds
                    .Where(roundData => roundData.CategoryName == null && !roundData.IsDefault)
                    // Sort rounds by predefined sort order
                    .OrderBy(roundData => roundData.RoundSortOrder)
                    // Project to FacetOption
                    .Select(roundData => new FacetOption(
                        roundData.RoundSlug,
                        roundData.RoundName,
                        roundData.RoundFullName,
                        roundData.Count))
                    // In-memory collection
                    .ToImmutableList();

                // Create the final CompetitionFilterOption
                return new CompetitionFilterOption(
                    new FacetOption(
                        competitionGroup.Key.CompetitionSlug,
                        competitionGroup.Key.CompetitionName,
                        competitionGroup.Key.CompetitionFullName,
                        competitionGroup.Sum(roundData => roundData.Count)
                    ),
                    roundsByCategory,
                    roundsWithoutCategory
                );
            })
            // In-memory collection
            .ToImmutableList();

        // Build problem number facet options (exclude invalid/problematic numbers)
        var problemNumberGroups = await problemNumbersScope
            // Group by problem number
            .GroupBy(problem => problem.Number)
            // Project to intermediate structure with counts
            .Select(numberGroup => new
            {
                Number = numberGroup.Key,
                Count = numberGroup.Count()
            })
            // Sort numerically
            .OrderBy(numberGroup => numberGroup.Number)
            // Execute the query
            .ToListAsync();

        // Create facet options for problem numbers
        var problemNumbers = problemNumberGroups
            // Map to FacetOption
            .Select(numberGroup => new FacetOption(
                numberGroup.Number.ToString(CultureInfo.InvariantCulture),
                numberGroup.Number.ToString(CultureInfo.InvariantCulture),
                FullName: null,
                numberGroup.Count))
            // In-memory collection
            .ToImmutableList();

        // Return the fully constructed search bar options
        return new SearchBarOptions(
            competitions,
            [.. seasonGroups],
            [.. problemNumbers],
            [.. tagGroups],
            [.. authorGroups]
        );
    }
}
