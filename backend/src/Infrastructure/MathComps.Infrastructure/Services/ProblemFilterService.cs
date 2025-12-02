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
    public async Task<FilterResult> FilterAsync(ProblemFilterOptions options)
    {
        // Convenient deconstruct
        var ((parameters, pageSize, pageNumber, favoritesOnly), userId) = options;

        // Positive page numbers indexed from 1
        if (pageNumber <= 0)
            throw new ArgumentException($"Page number must be greater than 0, but was {pageNumber}");

        // Positive page sizes
        if (pageSize <= 0)
            throw new ArgumentException($"Page size must be greater than 0, but was {pageSize}");

        // Not too large page sizes
        if (pageSize > paginationOptions.Value.MaxPageSize)
            throw new ArgumentException($"Page size {pageSize} exceeds maximum allowed {paginationOptions.Value.MaxPageSize}");

        // PERFORMANCE OPTIMIZATION: Materialize text search results once
        // This ensures the expensive text search executes exactly once, not multiple times across facets
        IQueryable<Problem> textFilteredQuery;

        // First, apply text search if present to create a base query for facets
        if (!string.IsNullOrWhiteSpace(parameters.SearchText))
        {
            // Execute the text search ONCE and materialize the problem IDs in memory
            var matchingProblemIds = await GetMatchingProblemIdsByTextSearchAsync(
                dbContext,
                parameters.SearchText,
                parameters.SearchInSolution);

            // Pre-filter problems to only include those with matching text
            // Uses cached problem IDs, no database round-trip for text search
            textFilteredQuery = dbContext.Problems
                .Where(problem => matchingProblemIds.Contains(problem.Id));
        }
        // No text search - start with all problems
        else textFilteredQuery = dbContext.Problems;

        // Apply remaining filters (years, contests, tags, authors, etc.) on top of text filter
        var filteredQuery = ApplyFilters(textFilteredQuery, parameters, favoritesOnly, userId);

        // Get total count
        var totalCount = await filteredQuery.CountAsync();

        // Build a query...
        var dtoQuery = filteredQuery
            // Apply consistent sorting for predictable pagination results
            .OrderByDefaultProblemSort()
            // Split query to avoid Cartesian explosion when accessing multiple collections
            .AsSplitQuery()
            // Which projects results to DTOs directly in the database query
            .Select(problem => new ProblemDto(problem.Slug,

                // To get the parsed statement, go through the texts
                problem.Texts
                    // That are statements, currently in the original language
                    .Where(text => text.DocumentType == DocumentType.Statement && text.IsOriginal && text.ParsedText != null)
                    // Get the parsed text
                    .Select(text => text.ParsedText)
                    // There should be exactly one text like that
                    .Single(),

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
                problem.ProblemTagsAll.AsQueryable()
                    .Where(ProblemTag.IsGoodEnoughTag)
                    .Select(problemTag => new TagDto(
                        problemTag.Tag.Slug,
                        problemTag.Tag.Name,
                        problemTag.Tag.TagType)
                    )
                    .ToImmutableList(),

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

                        // Get the first available statement parsed text for similar problem
                        similarProblem.SimilarProblem.Texts
                            // That are statements, currently in the original language
                            .Where(text => text.DocumentType == DocumentType.Statement && text.IsOriginal && text.ParsedText != null)
                            // Get the parsed text
                            .Select(text => text.ParsedText!)
                            // There should be exactly one text like that
                            .Single(),

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

                problem.SolutionLink,

                // Liked
                options.UserId != null && problem.Likes.Any(like => like.UserId == options.UserId),

                // LikeCount
                problem.Likes.Count
            ));

        // Retrieve the current page of DTOs
        var currentPageDtos = await dtoQuery
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Create paginated result set
        var pagedResults = new PagedList<ProblemDto>([.. currentPageDtos], pageNumber, pageSize, totalCount);

        // Build search bar options only for the first page to avoid unnecessary computation
        var searchBarOptions = pageNumber != 1 ? null :
             // Build search bar options with faceting on the text-filtered base query
             // Most facets use disjunctive faceting, while tags and authors use conjunctive faceting
             // when AND logic is selected with at least one item
             await BuildSearchOptionsAsync(textFilteredQuery, parameters, favoritesOnly, userId);

        // Return the complete filter result
        return new FilterResult(pagedResults, searchBarOptions);
    }

    /// <summary>
    /// Applies all active filters to the base query based on user's selections.
    /// </summary>
    /// <param name="problems">Base queryable to apply filters to</param>
    /// <param name="parameters">Filter parameters containing user selections and search criteria</param>
    /// <param name="favoritesOnly">Whether to filter only favorited problems</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <returns>Filtered queryable with all applicable conditions applied</returns>
    private static IQueryable<Problem> ApplyFilters(IQueryable<Problem> problems, FilterParameters parameters, bool favoritesOnly, Guid? userId)
    {
        // If favorites only is requested...
        if (favoritesOnly)
        {
            // If we have a user...
            if (userId.HasValue)
            {
                // Filter by likes
                problems = problems.Where(problem =>
                    problem.Likes.Any(like => like.UserId == userId.Value)
                );
            }
            // If we don't have a user (anonymous)...
            else
            {
                // Return nothing (anonymous users can't have favorites)
                problems = problems.Where(_ => false);
            }
        }

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
                // Include those...
                combinedSelectionPredicate = combinedSelectionPredicate.Or(problem =>
                    // Where competition matches
                    problem.RoundInstance.Round.Competition.Slug == competitionSlug &&
                    // And category matches (if specified)
                    problem.RoundInstance.Round.Category!.Slug == categorySlug &&
                    // And round matches
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
                        problem.ProblemTagsAll
                            .AsQueryable()
                            .Where(ProblemTag.IsGoodEnoughTag)
                            .Any(problemTag => parameters.TagSlugs.Contains(problemTag.Tag.Slug)));

                    break;

                // We want all tags
                case LogicToggle.And:

                    // We want all tags
                    foreach (var tagSlug in parameters.TagSlugs)
                    {
                        // Each iteration adds one more required tag
                        problems = problems.Where(problem =>
                            problem.ProblemTagsAll
                                .AsQueryable()
                                .Where(ProblemTag.IsGoodEnoughTag)
                                .Any(problemTag => problemTag.Tag.Slug == tagSlug));
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

        // The query is fully built
        return problems;
    }

    /// <summary>
    /// Builds search bar facet options with accurate counts using disjunctive or conjunctive faceting.
    /// Most facets use disjunctive faceting: each facet shows counts based on other active filters
    /// while ignoring its own selections, providing users with meaningful "available options" even when filters are active.
    /// Tags and authors use conjunctive faceting when AND logic is selected with at least one item:
    /// counts show "how many results if I add this tag/author" instead of "how many results are available",
    /// helping users understand the impact of adding additional filters in AND mode.
    /// </summary>
    /// <param name="baseQuery">Base queryable with all necessary includes</param>
    /// <param name="parameters">Current filter parameters used to determine facet counting behavior</param>
    /// <param name="favoritesOnly">Whether to filter only favorited problems</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <returns>Complete search bar options with facet counts and metadata</returns>
    private static async Task<SearchBarOptions> BuildSearchOptionsAsync(
        IQueryable<Problem> baseQuery,
        FilterParameters parameters,
        bool favoritesOnly,
        Guid? userId)
    {
        // Create facet-specific scopes by excluding each facet's own selections
        // This ensures counts reflect available options rather than current selections
        var seasonsScope = ApplyFilters(baseQuery, parameters with { OlympiadYears = [] }, favoritesOnly, userId);
        var problemNumbersScope = ApplyFilters(baseQuery, parameters with { ProblemNumbers = [] }, favoritesOnly, userId);
        var competitionsAndRoundsScope = ApplyFilters(baseQuery, parameters with { Contests = [] }, favoritesOnly, userId);

        // For tags: use conjunctive counting when AND logic is selected with at least one tag
        // This shows "how many results if I add this tag" instead of "how many results are available"
        // Otherwise, use disjunctive counting (exclude selected tags)
        var tagsScope = parameters.TagLogic == LogicToggle.And && parameters.TagSlugs.Count > 0
            ? ApplyFilters(baseQuery, parameters, favoritesOnly, userId)
            : ApplyFilters(baseQuery, parameters with { TagSlugs = [] }, favoritesOnly, userId);

        // For authors: Analogous logic to that of with tags
        var authorsScope = parameters.AuthorLogic == LogicToggle.And && parameters.AuthorSlugs.Count > 0
            ? ApplyFilters(baseQuery, parameters, favoritesOnly, userId)
            : ApplyFilters(baseQuery, parameters with { AuthorSlugs = [] }, favoritesOnly, userId);

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
            .SelectMany(Problem.GoodTags)
            .Select(pt => pt.Tag)
            // Group by unique tag (name + slug + type)
            .GroupBy(tag => new { tag.Name, tag.Slug, tag.TagType })
            // Project to intermediate structure with counts
            .Select(tagGroup => new
            {
                tagGroup.Key.Name,
                tagGroup.Key.Slug,
                tagGroup.Key.TagType,
                Count = tagGroup.Count()
            })
            // Most popular tags first
            .OrderByDescending(tag => tag.Count)
            // Then alphabetical
            .ThenBy(tag => tag.Name)
            // Project to TagFacetOption with type information
            .Select(tag => new TagFacetOption(tag.Slug, tag.Name, tag.Name, tag.Count, tag.TagType))
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
                    // Only consider rounds without categories
                    .Where(roundData => roundData.CategoryName == null)
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

    /// <summary>
    /// Gets problem IDs that match the given search text in statement and/or solution texts.
    /// Executes the text search efficiently once using PostgreSQL GIN index on unaccented text.
    /// </summary>
    /// <param name="dbContext">Database context for accessing problem texts</param>
    /// <param name="searchText">Text to search for (will be normalized for accent-insensitive matching)</param>
    /// <param name="searchInSolution">Whether to also search in solution texts or only statements</param>
    /// <returns>List of distinct problem IDs that contain the search text</returns>
    private static async Task<List<Guid>> GetMatchingProblemIdsByTextSearchAsync(
        MathCompsDbContext dbContext,
        string searchText,
        bool searchInSolution)
    {
        // Extract and normalize the search term for accent-insensitive matching
        var normalizedSearchTerm = $"%{searchText.RemoveAccents()}%";

        // Start with statement text search (always included)
        var textSearchQuery = dbContext.ProblemTexts
            .Where(text =>
                text.DocumentType == DocumentType.Statement &&
                EF.Functions.ILike(PostgresDbFunctions.Unaccent(text.RawText), normalizedSearchTerm));

        // If solution search is enabled...
        if (searchInSolution)
        {
            // We also want the problems that have the search term in their solution texts
            textSearchQuery = textSearchQuery.Union(
                dbContext.ProblemTexts
                    .Where(text =>
                        text.DocumentType == DocumentType.Solution &&
                        EF.Functions.ILike(PostgresDbFunctions.Unaccent(text.RawText), normalizedSearchTerm))
            );
        }

        // Return distinct problem IDs to avoid duplicates
        return await textSearchQuery.Select(text => text.ProblemId).ToListAsync();
    }
}
