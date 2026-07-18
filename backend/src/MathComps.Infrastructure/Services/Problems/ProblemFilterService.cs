using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Contracts.SearchBar;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Immutable;
using MathComps.Domain.Localization;
using MathComps.Shared.Linq;
using MathComps.Shared.Extensions;
namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// EF Core-backed implementation of problem retrieval and filtering aligned to API DTOs.
/// Provides paginated problem search with faceted filtering capabilities including competitions,
/// seasons, tags, authors, and full-text search with similarity matching.
/// </summary>
/// <param name="dbContext">Database context for accessing problem entities and related data</param>
/// <param name="paginationOptions">Configuration options for pagination limits and defaults</param>
/// <param name="similarityOptions">Configuration options for similarity scoring thresholds and limits</param>
/// <param name="localization">Service for resolving localized metadata display names</param>
public class ProblemFilterService(
    MathCompsDbContext dbContext,
    IOptionsSnapshot<PaginationOptions> paginationOptions,
    IOptionsSnapshot<SimilarityOptions> similarityOptions,
    IMetadataLocalizationService localization) : IProblemFilterService
{
    /// <inheritdoc/>
    public async Task<FilterResult> FilterAsync(ProblemFilterOptions options)
    {
        // Convenient deconstruct
        var ((parameters, pageSize, pageNumber, favoritesOnly, listContentId, markStatus), userId, language) = options;

        // Clamp paging into the allowed range rather than trusting the client — page numbers start at 1
        pageNumber = Math.Max(pageNumber, 1);

        // Page size stays within [1, configured max]
        pageSize = Math.Clamp(pageSize, 1, paginationOptions.Value.MaxPageSize);

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
        var filteredQuery = ApplyFilters(textFilteredQuery, parameters, favoritesOnly, listContentId, markStatus, userId);

        // Get total count
        var totalCount = await filteredQuery.CountAsync();

        // Build a query...
        var dtoQuery = filteredQuery
            // Apply consistent sorting for predictable pagination results
            .OrderByDefaultProblemSort()
            // Split query to avoid Cartesian explosion when accessing multiple collections
            .AsSplitQuery()
            // Get the statement
            .Select(problem => new
            {
                // The original problem instance
                problem,

                // Language-aware statement selection: prefer requested language, fallback to original
                // Select both text and language together to avoid query duplication
                Statement = problem.Texts
                    .Where(text =>
                        text.DocumentType == DocumentType.Statement &&
                        text.MarkdownText != null)
                    .OrderBy(text => text.Language == language ? 0 : (text.IsOriginal ? 1 : 2))
                    .First()
            })
            // Which projects results to DTOs directly in the database query
            .Select(data => new ProblemDto(
                // Simple properties
                data.problem.Slug,
                data.Statement.MarkdownText!,
                data.Statement.Language,

                // Problem Source
                new ProblemSource(
                    // Season
                    new LabeledSlug(
                        data.problem.RoundInstance.Season.EditionNumber.ToString(),
                        localization.GetSeasonLabel(
                            language,
                            data.problem.RoundInstance.Season.EditionNumber,
                            data.problem.RoundInstance.Season.StartYear,
                            data.problem.RoundInstance.Season.EndYear),
                        null
                    ),
                    // Competition
                    new LabeledSlug(
                        data.problem.RoundInstance.Round.Competition.Slug,
                        localization.GetCompetitionShortName(
                            language,
                            data.problem.RoundInstance.Round.Competition.Slug),
                        localization.GetCompetitionFullName(
                            language,
                            data.problem.RoundInstance.Round.Competition.Slug)
                    ),
                    // Round (may be null)
                    new LabeledSlug(
                        data.problem.RoundInstance.Round.Slug,
                        localization.GetRoundShortName(
                            language,
                            data.problem.RoundInstance.Round.Competition.Slug,
                            data.problem.RoundInstance.Round.Category != null ?
                                data.problem.RoundInstance.Round.Category.Slug : null,
                            !data.problem.RoundInstance.Round.IsDefault ? data.problem.RoundInstance.Round.Slug : null),
                        localization.GetRoundFullName(
                            language,
                            data.problem.RoundInstance.Round.Competition.Slug,
                            data.problem.RoundInstance.Round.Category != null ?
                                data.problem.RoundInstance.Round.Category.Slug : null,
                            !data.problem.RoundInstance.Round.IsDefault ? data.problem.RoundInstance.Round.Slug : null)
                    ),
                    // Category (may be null)
                    data.problem.RoundInstance.Round.Category == null ? null
                        : new LabeledSlug(
                            data.problem.RoundInstance.Round.Category.Slug,
                            localization.GetCategoryName(
                                language,
                                data.problem.RoundInstance.Round.Category.Slug),
                            null
                        ),
                    data.problem.Number
                ),

                // Tags
                data.problem.ProblemTagsAll.AsQueryable()
                    .Where(ProblemTag.IsGoodEnoughTag)
                    .Select(problemTag => new TagDto(
                        problemTag.Tag.Slug,
                        localization.GetTagName(
                            language,
                            problemTag.Tag.Slug),
                        problemTag.Tag.TagType)
                    )
                    .ToImmutableList(),

                // Authors
                data.problem.ProblemAuthors
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
                data.problem.SimilarProblems
                    // Only similar enough problems
                    .Where(similarProblem =>
                        similarProblem.SimilarityScore >= similarityOptions.Value.MinSimilarityScore)
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
                                localization.GetSeasonLabel(
                                    language,
                                    similarProblem.SimilarProblem.RoundInstance.Season.EditionNumber,
                                    similarProblem.SimilarProblem.RoundInstance.Season.StartYear,
                                    similarProblem.SimilarProblem.RoundInstance.Season.EndYear),
                                null
                            ),
                            // Competition
                            new LabeledSlug(
                                similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug,
                                localization.GetCompetitionShortName(
                                    language,
                                    similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug),
                                localization.GetCompetitionFullName(
                                    language,
                                    similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug)
                            ),
                            // Round
                            new LabeledSlug(
                                similarProblem.SimilarProblem.RoundInstance.Round.Slug,
                                // Round short name
                                localization.GetRoundShortName(
                                    language,
                                    // Competition slug
                                    similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug,
                                    // Category slug (may be null)
                                    similarProblem.SimilarProblem.RoundInstance.Round.Category != null ?
                                        similarProblem.SimilarProblem.RoundInstance.Round.Category.Slug : null,
                                    // Round slug
                                    !similarProblem.SimilarProblem.RoundInstance.Round.IsDefault ? similarProblem.SimilarProblem.RoundInstance.Round.Slug : null),
                                // Round full name
                                localization.GetRoundFullName(
                                    language,
                                    // Competition slug
                                    similarProblem.SimilarProblem.RoundInstance.Round.Competition.Slug,
                                    // Category slug (may be null)
                                    similarProblem.SimilarProblem.RoundInstance.Round.Category != null ?
                                        similarProblem.SimilarProblem.RoundInstance.Round.Category.Slug : null,
                                    // Round slug
                                    !similarProblem.SimilarProblem.RoundInstance.Round.IsDefault ? similarProblem.SimilarProblem.RoundInstance.Round.Slug : null)
                            ),
                            // Category (may be null)
                            similarProblem.SimilarProblem.RoundInstance.Round.Category == null ? null
                                : new LabeledSlug(
                                    similarProblem.SimilarProblem.RoundInstance.Round.Category.Slug,
                                    localization.GetCategoryName(
                                        language,
                                        similarProblem.SimilarProblem.RoundInstance.Round.Category.Slug),
                                    null
                                ),
                            similarProblem.SimilarProblem.Number
                        ),

                        // Language-aware statement selection for similar problem
                        similarProblem.SimilarProblem.Texts
                            .Where(text =>
                                text.DocumentType == DocumentType.Statement &&
                                text.MarkdownText != null)
                            .OrderBy(text => text.Language == language ? 0 : (text.IsOriginal ? 1 : 2))
                            .Select(text => text.MarkdownText!)
                            .First(),

                        // Language of the similar problem statement
                        similarProblem.SimilarProblem.Texts
                            .Where(text =>
                                text.DocumentType == DocumentType.Statement &&
                                text.MarkdownText != null)
                            .OrderBy(text => text.Language == language ? 0 : (text.IsOriginal ? 1 : 2))
                            .Select(text => text.Language)
                            .First(),

                        similarProblem.SimilarityScore
                    ))
                    // Evaluate
                    .ToImmutableList(),

                data.problem.SolutionLink,

                // Liked
                options.UserId != null && data.problem.Likes.Any(like => like.UserId == options.UserId),

                // Marked
                options.UserId != null && data.problem.MarkStatuses.Any(mark => mark.UserId == options.UserId),

                // LikeCount
                data.problem.Likes.Count,

                // CommentCount
                data.problem.ProblemComments.Count(problemComment => problemComment.Comment.Status == CommentStatus.Active),

                // ListContentIds — which of the user's lists contain this problem
                options.UserId != null
                    ? data.problem.UserProblemListItems
                        .Where(item => item.List.UserId == options.UserId)
                        .Select(item => item.List.ContentId)
                        .ToImmutableList()
                    : ImmutableList<string>.Empty
            ));

        // Retrieve the current page of DTOs
        var currentPageDtos = await dtoQuery
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Create paginated result set
        var pagedResults = new PagedList<ProblemDto>(
            [.. currentPageDtos],
            pageNumber,
            pageSize,
            totalCount
        );

        // Build search bar options only for the first page to avoid unnecessary computation
        var searchBarOptions = pageNumber != 1 ? null :
             // Build search bar options with faceting on the text-filtered base query
             // Most facets use disjunctive faceting, while tags and authors use conjunctive faceting
             // when AND logic is selected with at least one item
             await BuildSearchOptionsAsync(textFilteredQuery, parameters, favoritesOnly, listContentId, markStatus, userId, language);

        // Return the complete filter result
        return new FilterResult(pagedResults, searchBarOptions);
    }

    /// <summary>
    /// Applies all active filters to the base query based on user's selections.
    /// </summary>
    /// <param name="problems">Base queryable to apply filters to</param>
    /// <param name="parameters">Filter parameters containing user selections and search criteria</param>
    /// <param name="favoritesOnly">Whether to filter only favorited problems</param>
    /// <param name="listContentId">Optional ContentId of a user list to filter by</param>
    /// <param name="markStatus">Optional mark status filter</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <returns>Filtered queryable with all applicable conditions applied</returns>
    private static IQueryable<Problem> ApplyFilters(IQueryable<Problem> problems, FilterParameters parameters, bool favoritesOnly, string? listContentId, MarkStatusFilter? markStatus, Guid? userId)
    {
        // If favorites only is requested...
        if (favoritesOnly)
        {
            // Favorites require authentication
            if (!userId.HasValue)
                throw new FavoritesRequireAuthenticationException();

            // Filter by likes
            problems = problems.Where(problem =>
                problem.Likes.Any(like => like.UserId == userId.Value)
            );
        }

        // Requested only marked problems
        if (markStatus is MarkStatusFilter.Marked or MarkStatusFilter.Unmarked)
        {
            // Mark status filtering requires authentication
            if (!userId.HasValue)
                throw new MarkStatusRequiresAuthenticationException();

            // Only marked or unmarked problems
            problems = markStatus switch
            {
                MarkStatusFilter.Marked => problems.Where(problem =>
                    problem.MarkStatuses.Any(mark => mark.UserId == userId.Value)),

                MarkStatusFilter.Unmarked => problems.Where(problem =>
                    problem.MarkStatuses.All(mark => mark.UserId != userId.Value)),

                _ => throw new InvalidOperationException("Invalid mark status filter.")
            };
        }

        // If filtering by a specific user list...
        if (listContentId is not null)
        {
            // Filter to problems in the specified list (assuming user has access and this has been validated)
            problems = problems.Where(problem =>
                problem.UserProblemListItems.Any(item =>
                    item.List.ContentId == listContentId
                )
            );
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
                    throw new ArgumentOutOfRangeException(nameof(parameters), parameters.TagLogic, "Invalid tag logic option");
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
                    throw new ArgumentOutOfRangeException(nameof(parameters), parameters.TagLogic, "Invalid tag logic option");
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
    /// <param name="listContentId">Optional ContentId of a user list to filter by</param>
    /// <param name="markStatus">Optional mark status filter</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <param name="language">The language to use for facet labels and search options</param>
    /// <returns>Complete search bar options with facet counts and metadata</returns>
    private async Task<SearchBarOptions> BuildSearchOptionsAsync(
        IQueryable<Problem> baseQuery,
        FilterParameters parameters,
        bool favoritesOnly,
        string? listContentId,
        MarkStatusFilter? markStatus,
        Guid? userId,
        Language language)
    {
        // Create facet-specific scopes by excluding each facet's own selections
        // This ensures counts reflect available options rather than current selections
        var seasonsScope = ApplyFilters(baseQuery, parameters with { OlympiadYears = [] }, favoritesOnly, listContentId, markStatus, userId);
        var problemNumbersScope = ApplyFilters(baseQuery, parameters with { ProblemNumbers = [] }, favoritesOnly, listContentId, markStatus, userId);
        var competitionsAndRoundsScope = ApplyFilters(baseQuery, parameters with { Contests = [] }, favoritesOnly, listContentId, markStatus, userId);

        // For tags: use conjunctive counting when AND logic is selected with at least one tag
        // This shows "how many results if I add this tag" instead of "how many results are available"
        // Otherwise, use disjunctive counting (exclude selected tags)
        var tagsScope = parameters is { TagLogic: LogicToggle.And, TagSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, favoritesOnly, listContentId, markStatus, userId)
            : ApplyFilters(baseQuery, parameters with { TagSlugs = [] }, favoritesOnly, listContentId, markStatus, userId);

        // For authors: Analogous logic to that of with tags
        var authorsScope = parameters is { AuthorLogic: LogicToggle.And, AuthorSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, favoritesOnly, listContentId, markStatus, userId)
            : ApplyFilters(baseQuery, parameters with { AuthorSlugs = [] }, favoritesOnly, listContentId, markStatus, userId);

        // Build season facet options with problem counts
        var seasonGroups = (await seasonsScope
            // Group by unique seasons
            .GroupBy(problem => new
            {
                problem.RoundInstance.Season.EditionNumber,
                problem.RoundInstance.Season.StartYear
            })
            // Project to intermediate structure with counts
            .Select(seasonGroup => new
            {
                seasonGroup.Key.EditionNumber,
                seasonGroup.Key.StartYear,
                Count = seasonGroup.Count()
            })
            // Sort seasons by edition number descending (most recent first)
            .OrderByDescending(seasonGroup => seasonGroup.EditionNumber)
            // Execute the query to get raw data
            .ToListAsync())
            // In-memory projection to FacetOption after query execution with localization
            .Select(seasonGroup => new FacetOption(
                seasonGroup.EditionNumber.ToString(),
                localization.GetSeasonLabel(
                    language,
                    seasonGroup.EditionNumber,
                    seasonGroup.StartYear,
                    seasonGroup.StartYear + 1
                ),
                FullName: null,
                seasonGroup.Count))
            // In-memory collection
            .ToList();

        // Build tag facet options sorted by popularity then alphabetically
        var tagGroups = await tagsScope
            // Extract tags for grouping
            .SelectMany(Problem.GoodTags)
            .Select(pt => pt.Tag)
            // Group by unique tag (slug + type)
            .GroupBy(tag => new { tag.Slug, tag.TagType })
            // Project to intermediate structure with counts
            .Select(tagGroup => new
            {
                tagGroup.Key.Slug,
                tagGroup.Key.TagType,
                Count = tagGroup.Count()
            })
            // Most popular tags first
            .OrderByDescending(tag => tag.Count)
            // Then alphabetical
            .ThenBy(tag => tag.Slug)
            // Execute the query to materialize data for localization
            .ToListAsync();

        // Apply localization to tag display names (in-memory)
        var localizedTagGroups = tagGroups
            .Select(tag => new TagFacetOption(tag.Slug, localization.GetTagName(language, tag.Slug), localization.GetTagName(language, tag.Slug), tag.Count, tag.TagType))
            .ToList();

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
                CompetitionSlug = problem.RoundInstance.Round.Competition.Slug,
                CompetitionSortOrder = problem.RoundInstance.Round.Competition.SortOrder,
                CategorySlug = problem.RoundInstance.Round.Category != null ? problem.RoundInstance.Round.Category.Slug : null,
                CategorySortOrder = problem.RoundInstance.Round.Category != null ? problem.RoundInstance.Round.Category.SortOrder : (int?)null,
                RoundSlug = problem.RoundInstance.Round.Slug,
                RoundSortOrder = problem.RoundInstance.Round.SortOrder,
                problem.RoundInstance.Round.IsDefault,
            })
            // Project to intermediate structure with counts
            .Select(competitionGroup => new
            {
                competitionGroup.Key.CompetitionSlug,
                competitionGroup.Key.CompetitionSortOrder,
                competitionGroup.Key.CategorySlug,
                competitionGroup.Key.CategorySortOrder,
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
            .GroupBy(row => new
            {
                row.CompetitionSlug,
                row.CompetitionSortOrder,
            })
            // Sort competitions by predefined sort order
            .OrderBy(competitionGroup => competitionGroup.Key.CompetitionSortOrder)
            // Project to CompetitionFilterOption with nested categories and rounds
            .Select(competitionGroup =>
            {
                // Group rounds by category within this competition
                var roundsByCategory = competitionGroup
                    // Only consider rounds with categories for this grouping
                    .Where(roundData => roundData.CategorySlug != null)
                    // Group by category
                    .GroupBy(roundData => new
                    {
                        CategorySlug = roundData.CategorySlug!,
                        roundData.CategorySortOrder
                    })
                    // Sort categories by predefined sort order
                    .OrderBy(categoryGroup => categoryGroup.Key.CategorySortOrder)
                    // Project to CategoryFilterOption with nested rounds
                    .Select(categoryGroup => new CategoryFilterOption(
                        // Category option with aggregated count and localized name
                        new FacetOption(
                            categoryGroup.Key.CategorySlug,
                            localization.GetCategoryName(language, categoryGroup.Key.CategorySlug),
                            FullName: null,
                            categoryGroup.Sum(roundData => roundData.Count)
                        ),
                        // Rounds within this category with localized names
                        [.. categoryGroup
                            // Sort rounds by predefined sort order
                            .OrderBy(roundData => roundData.RoundSortOrder)
                            // Project to FacetOption with localized round name
                            .Select(roundData => new FacetOption(
                                roundData.RoundSlug,
                                localization.GetRoundShortName(
                                    language,
                                    competitionGroup.Key.CompetitionSlug,
                                    categoryGroup.Key.CategorySlug,
                                    !roundData.IsDefault ? roundData.RoundSlug : null
                                ),
                                localization.GetRoundFullName(
                                    language,
                                    competitionGroup.Key.CompetitionSlug,
                                    categoryGroup.Key.CategorySlug,
                                    !roundData.IsDefault ? roundData.RoundSlug : null
                                ),
                                roundData.Count
                            )),
                        ]
                    ))
                    // In-memory collection
                    .ToImmutableList();

                // Handle rounds without categories (direct competition rounds)
                var roundsWithoutCategory = competitionGroup
                    // Only consider rounds without categories, excluding default rounds
                    // (Default rounds are implicit and should not appear as children in the tree)
                    .Where(roundData => roundData.CategorySlug == null && !roundData.IsDefault)
                    // Sort rounds by predefined sort order
                    .OrderBy(roundData => roundData.RoundSortOrder)
                    // Project to FacetOption with localized round name
                    .Select(roundData => new FacetOption(
                        roundData.RoundSlug,
                        localization.GetRoundShortName(
                            language,
                            competitionGroup.Key.CompetitionSlug,
                            categorySlug: null,
                            roundData.RoundSlug
                        ),
                        localization.GetRoundFullName(
                            language,
                            competitionGroup.Key.CompetitionSlug,
                            categorySlug: null,
                            roundData.RoundSlug
                        ),
                        roundData.Count
                    ))
                    // In-memory collection
                    .ToImmutableList();

                // Create the final CompetitionFilterOption with localized names
                return new CompetitionFilterOption(
                    new FacetOption(
                        competitionGroup.Key.CompetitionSlug,
                        localization.GetCompetitionShortName(language, competitionGroup.Key.CompetitionSlug),
                        localization.GetCompetitionFullName(language, competitionGroup.Key.CompetitionSlug),
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
                numberGroup.Number.ToString(),
                numberGroup.Number.ToString(),
                FullName: null,
                numberGroup.Count))
            // In-memory collection
            .ToImmutableList();

        // Return the fully constructed search bar options
        return new SearchBarOptions(
            competitions,
            [.. seasonGroups],
            [.. problemNumbers],
            [.. localizedTagGroups],
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
                text.RawText != null &&
                EF.Functions.ILike(PostgresDbFunctions.Unaccent(text.RawText), normalizedSearchTerm));

        // If solution search is enabled...
        if (searchInSolution)
        {
            // We also want the problems that have the search term in their solution texts
            textSearchQuery = textSearchQuery.Union(
                dbContext.ProblemTexts
                    .Where(text =>
                        text.DocumentType == DocumentType.Solution &&
                        text.RawText != null &&
                        EF.Functions.ILike(PostgresDbFunctions.Unaccent(text.RawText), normalizedSearchTerm))
            );
        }

        // Return distinct problem IDs to avoid duplicates
        return await textSearchQuery.Select(text => text.ProblemId).ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<SeasonContestBrowserResult> GetContestsBySeasonAsync(Language language)
    {
        // Group all problems by their common contest data
        // We will then take only these data + problem count to build the result
        var contestData = await dbContext.Problems
            .GroupBy(problem => new
            {
                problem.RoundInstance.Season.EditionNumber,
                problem.RoundInstance.Season.StartYear,
                CompetitionSlug = problem.RoundInstance.Round.Competition.Slug,
                CompetitionSortOrder = problem.RoundInstance.Round.Competition.SortOrder,
                CategorySlug = problem.RoundInstance.Round.Category != null ? problem.RoundInstance.Round.Category.Slug : null,
                CategorySortOrder = problem.RoundInstance.Round.Category != null ? problem.RoundInstance.Round.Category.SortOrder : (int?)null,
                RoundSlug = problem.RoundInstance.Round.Slug,
                RoundSortOrder = problem.RoundInstance.Round.SortOrder,
                IsDefaultRound = problem.RoundInstance.Round.IsDefault,
            })
            .Select(group => new
            {
                group.Key.EditionNumber,
                group.Key.StartYear,
                group.Key.CompetitionSlug,
                group.Key.CompetitionSortOrder,
                group.Key.CategorySlug,
                group.Key.CategorySortOrder,
                group.Key.RoundSlug,
                group.Key.RoundSortOrder,
                group.Key.IsDefaultRound,
                ProblemCount = group.Count()
            })
            .ToListAsync();

        // Build the hierarchical result in memory
        var seasonGroups = contestData
            // Group by season
            .GroupBy(data => new { data.EditionNumber, data.StartYear })
            // Order by newest first
            .OrderByDescending(group => group.Key.EditionNumber)
            // Create a season object for each group
            .Select(seasonGroup =>
            {
                // Build flattened contest list for this season with localized display names
                var contests = seasonGroup
                    // Order by competition, then category, then round
                    .OrderBy(group => group.CompetitionSortOrder)
                    .ThenBy(group => group.CategorySortOrder ?? 0)
                    .ThenBy(group => group.RoundSortOrder)
                    .Select(group => new ContestWithCount(
                        group.CompetitionSlug,
                        group.CategorySlug,
                        !group.IsDefaultRound ? group.RoundSlug : null,
                        localization.GetCompetitionShortName(language, group.CompetitionSlug),
                        group.CategorySlug != null ? localization.GetCategoryName(
                            language,
                            group.CategorySlug
                        ) : null,
                        !group.IsDefaultRound ? localization.GetRoundShortName(
                            language,
                            group.CompetitionSlug,
                            group.CategorySlug,
                            group.RoundSlug
                        ) : null,
                        group.ProblemCount
                    ));

                // Return season-specific data with localized label
                return new SeasonContestsGroup(
                    seasonGroup.Key.EditionNumber,
                    localization.GetSeasonLabel(
                        language,
                        seasonGroup.Key.EditionNumber,
                        seasonGroup.Key.StartYear,
                        seasonGroup.Key.StartYear + 1
                    ),
                    [.. contests]
                );
            });

        // Build the result with all seasons
        return new SeasonContestBrowserResult([.. seasonGroups]);
    }
}

