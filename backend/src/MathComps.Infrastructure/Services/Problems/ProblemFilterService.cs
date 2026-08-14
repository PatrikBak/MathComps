using MathComps.Domain.Contracts.Helpers;
using MathComps.Domain.Contracts.ProblemQuery;
using MathComps.Domain.Contracts.SearchBar;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Pagination;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Immutable;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
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

        // The page as it will be served, which is how much of the filtered set one request can ask for.
        var bounds = PageBounds.ForRequestedPage(paginationOptions.Value, pageSize, pageNumber);

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

        // The contests the selections name, each standing for its whole subtree; empty when nothing is selected
        var contestIds = await ResolveContestIdsAsync(parameters.Contests);

        // Apply remaining filters (years, contests, tags, authors, etc.) on top of text filter
        var filteredQuery = ApplyFilters(textFilteredQuery, parameters,
            contestIds, favoritesOnly, listContentId, markStatus, userId);

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
                BuildSource(
                    localization,
                    data.problem.Round.Season.EditionNumber,
                    data.problem.Round.Season.StartYear,
                    data.problem.Round.Season.EndYear,
                    data.problem.Round.Competition.Path,
                    data.problem.Round.Competition.SortPath,
                    data.problem.Number,
                    language),

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
                        BuildSource(
                            localization,
                            similarProblem.SimilarProblem.Round.Season.EditionNumber,
                            similarProblem.SimilarProblem.Round.Season.StartYear,
                            similarProblem.SimilarProblem.Round.Season.EndYear,
                            similarProblem.SimilarProblem.Round.Competition.Path,
                            similarProblem.SimilarProblem.Round.Competition.SortPath,
                            similarProblem.SimilarProblem.Number,
                            language),

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
            .Skip(bounds.Skip)
            .Take(bounds.PageSize)
            .ToListAsync();

        // Create paginated result set
        var pagedResults = new PagedList<ProblemDto>(
            [.. currentPageDtos],
            bounds.PageNumber,
            bounds.PageSize,
            totalCount
        );

        // Build search bar options only for the first page to avoid unnecessary computation
        var searchBarOptions = bounds.PageNumber != 1 ? null :
             // Build search bar options with faceting on the text-filtered base query
             // Most facets use disjunctive faceting, while tags and authors use conjunctive faceting
             // when AND logic is selected with at least one item
             await BuildSearchOptionsAsync(textFilteredQuery, parameters, contestIds,
                 favoritesOnly, listContentId, markStatus, userId, language);

        // Return the complete filter result
        return new FilterResult(pagedResults, searchBarOptions);
    }

    /// <summary>
    /// Applies all active filters to the base query based on user's selections.
    /// </summary>
    /// <param name="problems">Base queryable to apply filters to</param>
    /// <param name="parameters">Filter parameters containing user selections and search criteria</param>
    /// <param name="contestIds">Every contest the selections resolve to, subtrees included</param>
    /// <param name="favoritesOnly">Whether to filter only favorited problems</param>
    /// <param name="listContentId">Optional ContentId of a user list to filter by</param>
    /// <param name="markStatus">Optional mark status filter</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <returns>Filtered queryable with all applicable conditions applied</returns>
    private static IQueryable<Problem> ApplyFilters(
        IQueryable<Problem> problems,
        ProblemFilterCriteria parameters,
        IReadOnlyCollection<Guid> contestIds,
        bool favoritesOnly,
        string? listContentId,
        MarkStatusFilter? markStatus,
        Guid? userId)
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
                parameters.OlympiadYears.Contains(problem.Round.Season.EditionNumber)
            );
        }

        // If contests are specified..
        if (parameters.Contests is { Count: > 0 })
        {
            // Keep the problems sitting anywhere under one of them, which is what the resolved ids stand for
            problems = problems.Where(problem => contestIds.Contains(problem.Round.CompetitionId));
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
    /// <param name="contestIds"><inheritdoc cref="ApplyFilters" path="/param[@name='contestIds']"/></param>
    /// <param name="favoritesOnly">Whether to filter only favorited problems</param>
    /// <param name="listContentId">Optional ContentId of a user list to filter by</param>
    /// <param name="markStatus">Optional mark status filter</param>
    /// <param name="userId">The ID of the current user (nullable)</param>
    /// <param name="language">The language to use for facet labels and search options</param>
    /// <returns>Complete search bar options with facet counts and metadata</returns>
    private async Task<SearchBarOptions> BuildSearchOptionsAsync(
        IQueryable<Problem> baseQuery,
        ProblemFilterCriteria parameters,
        IReadOnlyCollection<Guid> contestIds,
        bool favoritesOnly,
        string? listContentId,
        MarkStatusFilter? markStatus,
        Guid? userId,
        Language language)
    {
        // Create facet-specific scopes by excluding each facet's own selections
        // This ensures counts reflect available options rather than current selections
        var seasonsScope = ApplyFilters(baseQuery, parameters with { OlympiadYears = [] },
            contestIds, favoritesOnly, listContentId, markStatus, userId);
        var problemNumbersScope = ApplyFilters(baseQuery, parameters with { ProblemNumbers = [] },
            contestIds, favoritesOnly, listContentId, markStatus, userId);
        var competitionsAndRoundsScope = ApplyFilters(baseQuery, parameters with { Contests = [] },
            contestIds, favoritesOnly, listContentId, markStatus, userId);

        // For tags: use conjunctive counting when AND logic is selected with at least one tag
        // This shows "how many results if I add this tag" instead of "how many results are available"
        // Otherwise, use disjunctive counting (exclude selected tags)
        var tagsScope = parameters is { TagLogic: LogicToggle.And, TagSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, contestIds, favoritesOnly, listContentId, markStatus, userId)
            : ApplyFilters(baseQuery, parameters with { TagSlugs = [] },
                contestIds, favoritesOnly, listContentId, markStatus, userId);

        // For authors: Analogous logic to that of with tags
        var authorsScope = parameters is { AuthorLogic: LogicToggle.And, AuthorSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, contestIds, favoritesOnly, listContentId, markStatus, userId)
            : ApplyFilters(baseQuery, parameters with { AuthorSlugs = [] },
                contestIds, favoritesOnly, listContentId, markStatus, userId);

        // Build season facet options with problem counts
        var seasonGroups = (await seasonsScope
            // Group by unique seasons
            .GroupBy(problem => new
            {
                problem.Round.Season.EditionNumber,
                problem.Round.Season.StartYear
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

        // Count the problems each contest holds, which is all the tree needs to be folded back up
        var contestCounts = await CountByContestAsync(competitionsAndRoundsScope);

        // Organize the contests into the three levels the search bar reads
        var competitions = contestCounts
            // Group by the competition each contest descends from
            .GroupBy(contest => contest.Levels.Competition)
            // Sort competitions by their place in the registry
            .OrderBy(competitionGroup => competitionGroup.Key.SortKey, StringComparer.Ordinal)
            // Project to CompetitionFilterOption with nested categories and rounds
            .Select(competitionGroup =>
            {
                // Group rounds by category within this competition
                var roundsByCategory = competitionGroup
                    // Only consider rounds sitting under a category
                    .Where(contest => contest.Levels.Category is not null)
                    // Group by category
                    .GroupBy(contest => contest.Levels.Category!)
                    // Sort categories by their place in the registry
                    .OrderBy(categoryGroup => categoryGroup.Key.SortKey, StringComparer.Ordinal)
                    // Project to CategoryFilterOption with nested rounds
                    .Select(categoryGroup => new CategoryFilterOption(
                        // Category option with aggregated count and localized name
                        new FacetOption(
                            categoryGroup.Key.Slug,
                            localization.GetNodeShortName(language, categoryGroup.Key.Path),
                            localization.GetNodeFullName(language, categoryGroup.Key.Path),
                            categoryGroup.Sum(contest => contest.Count)
                        ),
                        // Rounds within this category with localized names
                        [.. categoryGroup
                            // Sort rounds by their place in the registry
                            .OrderBy(contest => contest.Levels.Round!.SortKey, StringComparer.Ordinal)
                            // Project to FacetOption with localized round name
                            .Select(contest => RoundFacet(contest, language)),
                        ]
                    ))
                    // In-memory collection
                    .ToImmutableList();

                // Handle rounds hanging straight off the competition. A contest that IS its competition has no
                // round to offer — it stands for the whole thing — so it only contributes its count.
                var roundsWithoutCategory = competitionGroup
                    // Only consider rounds one level under the competition
                    .Where(contest => contest.Levels is { Category: null, Round: not null })
                    // Sort rounds by their place in the registry
                    .OrderBy(contest => contest.Levels.Round!.SortKey, StringComparer.Ordinal)
                    // Project to FacetOption with localized round name
                    .Select(contest => RoundFacet(contest, language))
                    // In-memory collection
                    .ToImmutableList();

                // Create the final CompetitionFilterOption with localized names
                return new CompetitionFilterOption(
                    new FacetOption(
                        competitionGroup.Key.Slug,
                        localization.GetNodeShortName(language, competitionGroup.Key.Path),
                        localization.GetNodeFullName(language, competitionGroup.Key.Path),
                        competitionGroup.Sum(contest => contest.Count)
                    ),
                    roundsByCategory,
                    roundsWithoutCategory
                );
            })
            // In-memory collection
            .ToImmutableList();

        // The same contests as the tree they actually form, each carrying its whole subtree's count
        var contests = BuildContestTree(contestCounts, language);

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
            contests,
            [.. seasonGroups],
            [.. problemNumbers],
            [.. localizedTagGroups],
            [.. authorGroups]
        );
    }

    /// <summary>
    /// Names the season a problem was set in and the contest it belongs to, at each of the levels the archive
    /// shows: the competition, the category within it when there is one, and the round.
    /// </summary>
    /// <remarks>
    /// Static, and handed the localization service instead of reading the field, because the projection that
    /// calls it is an expression tree: an instance member puts this service in that tree as a constant, which
    /// EF refuses to compile.
    /// </remarks>
    /// <param name="localization">The resolver of localized display names.</param>
    /// <param name="editionNumber">The season's edition number.</param>
    /// <param name="startYear">The calendar year the season started.</param>
    /// <param name="endYear">The calendar year the season ended.</param>
    /// <param name="competitionPath">The path of the contest the problem sits in.</param>
    /// <param name="contestSortPath">The sort path of that contest.</param>
    /// <param name="number">The problem's number within its contest.</param>
    /// <param name="language">The language to label everything in.</param>
    /// <returns>The problem's source.</returns>
    private static ProblemSource BuildSource(
        IMetadataLocalizationService localization,
        int editionNumber,
        int startYear,
        int endYear,
        string competitionPath,
        string contestSortPath,
        int number,
        Language language)
    {
        // Where the contest sits, which decides which of the levels below it is named at all.
        var levels = ContestLevels.From(competitionPath, contestSortPath);

        // The labelled slug of one level, whose path is what its localized names are keyed by.
        LabeledSlug Label(ContestLevel level) => new(
            level.Slug,
            localization.GetNodeShortName(language, level.Path),
            localization.GetNodeFullName(language, level.Path));

        // The season, labelled from its own template.
        var season = new LabeledSlug(
            editionNumber.ToString(),
            localization.GetSeasonLabel(language, editionNumber, startYear, endYear));

        // The contest spelled out as every contest down to it, each addressed by its own path, which is what
        // its localized names are keyed by.
        var contest = CompetitionTree.Descend(competitionPath)
            .Select(node => new LabeledSlug(
                node.Path,
                localization.GetNodeShortName(language, node.Path),
                localization.GetNodeFullName(language, node.Path)))
            .ToImmutableList();

        // A whole competition names no round, and a contest outside a category names no category.
        return new ProblemSource(
            season,
            contest,
            Label(levels.Competition),
            levels.Round is null ? null : Label(levels.Round),
            levels.Category is null ? null : Label(levels.Category),
            number);
    }

    /// <summary>
    /// One contest and how many problems of the current scope sit in it.
    /// </summary>
    /// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <param name="SortPath"><inheritdoc cref="Competition.SortPath" path="/summary"/></param>
    /// <param name="Count">How many problems it holds.</param>
    private record ContestCount(string Path, string SortPath, int Count)
    {
        /// <summary>
        /// The contest projected onto the competition / category / round levels, which is what the frozen
        /// three-level contracts are still built from.
        /// </summary>
        public ContestLevels Levels { get; } = ContestLevels.From(Path, SortPath);
    }

    /// <summary>
    /// Counts the problems of a scope per contest. Problems hang off a contest at whatever depth it sits, so
    /// one group per contest is the finest split there is; every roll-up above it is a fold over these.
    /// </summary>
    /// <param name="scope">The problems to count.</param>
    /// <returns>One entry per contest holding at least one problem.</returns>
    private static async Task<List<ContestCount>> CountByContestAsync(IQueryable<Problem> scope) =>
        [.. (await scope
            // Group by the contest the problems belong to, which its two paths identify and order
            .GroupBy(problem => new
            {
                problem.Round.Competition.Path,
                problem.Round.Competition.SortPath,
            })
            // Project to intermediate structure with counts
            .Select(contestGroup => new
            {
                contestGroup.Key.Path,
                contestGroup.Key.SortPath,
                Count = contestGroup.Count(),
            })
            // Execute the query
            .ToListAsync())
            // Wrap each into a counted contest, which reads its levels off its own two paths
            .Select(contest => new ContestCount(contest.Path, contest.SortPath, contest.Count))];

    /// <summary>
    /// Builds the facet option for a contest that is a round, i.e. one that sits below its competition.
    /// </summary>
    /// <param name="contest">The counted contest, whose round level carries the name and the slug.</param>
    /// <param name="language">The language to label it in.</param>
    /// <returns>The round's facet option.</returns>
    private FacetOption RoundFacet(ContestCount contest, Language language) =>
        // The round's own path is what its localized names are keyed by.
        new(contest.Levels.Round!.Slug,
            localization.GetNodeShortName(language, contest.Levels.Round.Path),
            localization.GetNodeFullName(language, contest.Levels.Round.Path),
            contest.Count);

    /// <summary>
    /// One contest on the chain down to a counted one — how the tree addresses it, and where it sits.
    /// </summary>
    /// <param name="ParentPath">The path of the contest one level up, null at a competition.</param>
    /// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <param name="SortKey">Its zero-padded position among its siblings, which sorts as it reads.</param>
    private record ContestPlace(string? ParentPath, string Path, string SortKey);

    /// <summary>
    /// The contests a counted contest hangs from, root-first, itself last. Its two paths spell out the same
    /// chain — the slugs down to it, and their sibling positions — so each contest on it takes its own path
    /// from the one and its position from the other.
    /// </summary>
    /// <param name="contest">The counted contest to walk down to.</param>
    /// <returns>One place per segment of its path.</returns>
    private static IEnumerable<ContestPlace> ChainOf(ContestCount contest)
    {
        // The sibling positions down to the contest, which pair up with its slugs index by index. Indexing
        // rather than zipping, so two paths of different depths fail loudly instead of yielding half a chain.
        var sortKeys = contest.SortPath.Split('.');

        // One place per segment, each taking the position its own generation is ordered by.
        return CompetitionTree.Descend(contest.Path)
            .Select((node, depth) => new ContestPlace(node.ParentPath, node.Path, sortKeys[depth]));
    }

    /// <summary>
    /// Folds counted contests back into the tree they came from: every contest holding problems, and every
    /// contest above it, each carrying what its whole subtree holds. A contest nothing was counted under never
    /// appears, so the tree offers exactly what the current scope can still be narrowed to.
    /// </summary>
    /// <param name="contests">The counted contests, one per contest holding problems.</param>
    /// <param name="language">The language to label the contests in.</param>
    /// <returns>The competitions, each carrying everything below it.</returns>
    private ImmutableList<ContestNodeOption> BuildContestTree(
        IReadOnlyCollection<ContestCount> contests,
        Language language)
    {
        // Each count landing on every contest on the chain down to it, since a contest's total is its whole
        // subtree's and not just what hangs off it directly
        var counted = contests.SelectMany(contest =>
            ChainOf(contest).Select(place => (Place: place, contest.Count)));

        // The contests to offer, totalled per contest and gathered under the one they hang from — a competition
        // under the null one, since nothing hangs above it
        var byParent = counted
            .GroupBy(entry => entry.Place, entry => entry.Count)
            .Select(group => (Place: group.Key, Count: group.Sum()))
            .ToLookup(total => total.Place.ParentPath);

        // Offers one generation, each contest carrying everything the fold left below it.
        ImmutableList<ContestNodeOption> Offer(string? parentPath) =>
            [.. byParent[parentPath]
                // Siblings read in the order the registry places them
                .OrderBy(total => total.Place.SortKey, StringComparer.Ordinal)
                // Each contest is named by its own path, and carries the generation below it
                .Select(total => new ContestNodeOption(
                    total.Place.Path,
                    localization.GetNodeShortName(language, total.Place.Path),
                    localization.GetNodeFullName(language, total.Place.Path),
                    total.Count,
                    Offer(total.Place.Path)))];

        // The competitions, which nothing hangs above
        return Offer(parentPath: null);
    }

    /// <summary>
    /// Resolves contest selections to every contest they cover: each selected node and everything below it,
    /// since selecting a competition means selecting the rounds inside it. A selection naming a contest that
    /// isn't there resolves to nothing and so matches nothing.
    /// </summary>
    /// <param name="selections">The contest selections to resolve, possibly none.</param>
    /// <returns>The ids of every covered contest.</returns>
    private async Task<IReadOnlyCollection<Guid>> ResolveContestIdsAsync(ImmutableList<ContestSelection> selections)
    {
        // Nothing selected means no lookup to do, and the filter skips the term entirely.
        if (selections.Count == 0)
            return [];

        // The path each selection addresses, which is how a contest is named across the whole system. One
        // carrying its path names its contest outright; the three slugs spell out the same path, as far down
        // as they reach.
        var selectedPaths = selections
            .Select(selection => selection.Path ?? TaxonomySlugs.ComposeCompetitionPath(
                selection.CompetitionSlug, selection.CategorySlug, selection.RoundSlug))
            .ToList();

        // The whole tree, which is small enough to walk in memory.
        var contests = await dbContext.Competitions.AsNoTracking()
            .Select(competition => new { competition.Id, competition.Path })
            .ToListAsync();

        // A contest is covered when it is selected itself or descends from something that is.
        return [.. contests
            .Where(contest => selectedPaths.Any(selected => TaxonomySlugs.IsAtOrUnder(contest.Path, selected)))
            .Select(contest => contest.Id)];
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

        // Start with statement text search (always included). We match the markdown-native text, falling
        // back to the legacy TeX raw text: markdown-only imports have no raw text, TeX-only rows have no
        // markdown, so the coalesce covers both. The ?? becomes SQL COALESCE, matching the index expression.
        var textSearchQuery = dbContext.ProblemTexts
            .Where(text =>
                text.DocumentType == DocumentType.Statement &&
                EF.Functions.ILike(
                    PostgresDbFunctions.Unaccent((text.MarkdownText ?? text.RawText)!), normalizedSearchTerm));

        // If solution search is enabled...
        if (searchInSolution)
        {
            // We also want the problems that have the search term in their solution texts
            textSearchQuery = textSearchQuery.Union(
                dbContext.ProblemTexts
                    .Where(text =>
                        text.DocumentType == DocumentType.Solution &&
                        EF.Functions.ILike(
                            PostgresDbFunctions.Unaccent((text.MarkdownText ?? text.RawText)!), normalizedSearchTerm))
            );
        }

        // Return distinct problem IDs to avoid duplicates
        return await textSearchQuery.Select(text => text.ProblemId).ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<SeasonContestBrowserResult> GetContestsBySeasonAsync(Language language)
    {
        // Group all problems by the season and the contest they belong to
        // We will then take only these data + problem count to build the result
        var contestData = await dbContext.Problems
            .GroupBy(problem => new
            {
                problem.Round.Season.EditionNumber,
                problem.Round.Season.StartYear,
                problem.Round.Competition.Path,
                problem.Round.Competition.SortPath,
            })
            .Select(group => new
            {
                group.Key.EditionNumber,
                group.Key.StartYear,
                group.Key.Path,
                group.Key.SortPath,
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
                    // Order down the tree, which orders competitions, then categories, then rounds
                    .OrderBy(group => group.SortPath, StringComparer.Ordinal)
                    .Select(group =>
                    {
                        // Where the contest sits, which decides which levels it names at all
                        var levels = ContestLevels.From(group.Path, group.SortPath);

                        // Every contest down to this one, named as it is shown, root-first
                        var labels = CompetitionTree.Descend(group.Path)
                            .Select(node => localization.GetNodeShortName(language, node.Path))
                            .ToImmutableList();

                        // A whole competition names no category and no round; a round outside a category names one
                        return new ContestWithCount(
                            group.Path,
                            labels,
                            levels.Competition.Slug,
                            levels.Category?.Slug,
                            levels.Round?.Slug,
                            localization.GetNodeShortName(language, levels.Competition.Path),
                            levels.Category is null ? null
                                : localization.GetNodeShortName(language, levels.Category.Path),
                            levels.Round is null ? null
                                : localization.GetNodeShortName(language, levels.Round.Path),
                            group.ProblemCount);
                    });

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

