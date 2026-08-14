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
using System.Diagnostics;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Shared.Extensions;
namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// EF Core-backed implementation of <see cref="IProblemFilterService"/>. A page of problems and the facet
/// counts beside it are separate queries over one filtered set, the page projected to its DTO in the database.
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
        var ((parameters, pageSize, pageNumber, favoritesOnly, includeBaseOptions, listContentId, markStatus),
            userId, language) = options;

        // The page as it will be served, which is how much of the filtered set one request can ask for.
        var bounds = PageBounds.ForRequestedPage(paginationOptions.Value, pageSize, pageNumber);

        // The problems the text search leaves, or all of them when nothing was searched for
        IQueryable<Problem> textFilteredQuery;

        // If something was searched for...
        if (!string.IsNullOrWhiteSpace(parameters.SearchText))
        {
            // Run the search once and hold its ids in memory, since each facet would otherwise re-run it
            var matchingProblemIds = await GetMatchingProblemIdsByTextSearchAsync(
                dbContext,
                parameters.SearchText,
                parameters.SearchInSolution);

            // Narrow to the problems those ids name
            textFilteredQuery = dbContext.Problems
                .Where(problem => matchingProblemIds.Contains(problem.Id));
        }
        // Nothing was searched for, so every problem is still in play
        else textFilteredQuery = dbContext.Problems;

        // The competitions the selected paths name, each standing for its whole subtree; empty when none is selected
        var competitionIds = await ResolveCompetitionIdsAsync(parameters.CompetitionPaths);

        // Everything this request narrows by outside its facet criteria
        var terms = new FilterTerms(competitionIds, favoritesOnly, listContentId, markStatus, userId);

        // Apply remaining filters (years, competitions, tags, authors, etc.) on top of text filter
        var filteredQuery = ApplyFilters(textFilteredQuery, parameters, terms);

        // Get total count
        var totalCount = await filteredQuery.CountAsync();

        // The filtered problems, each shaped into its DTO
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
                Statement = problem.Texts
                    .Where(text =>
                        text.DocumentType == DocumentType.Statement &&
                        text.MarkdownText != null)
                    .OrderBy(text => text.Language == language ? 0 : (text.IsOriginal ? 1 : 2))
                    .Select(text => text.MarkdownText!)
                    .First()
            })
            // Build the DTO from it
            .Select(data => new ProblemDto(
                // How the problem is addressed
                data.problem.Slug,

                // What it asks
                data.Statement,

                // Problem Source
                BuildSource(
                    localization,
                    data.problem.Round.Season.EditionNumber,
                    data.problem.Round.Season.StartYear,
                    data.problem.Round.Competition.Path,
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
                            similarProblem.SimilarProblem.Round.Competition.Path,
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

                        similarProblem.SimilarityScore
                    ))
                    // Evaluate
                    .ToImmutableList(),

                data.problem.SolutionLink,

                // Liked
                userId != null && data.problem.Likes.Any(like => like.UserId == userId),

                // Marked
                userId != null && data.problem.MarkStatuses.Any(mark => mark.UserId == userId),

                // LikeCount
                data.problem.Likes.Count,

                // CommentCount
                data.problem.ProblemComments.Count(problemComment => problemComment.Comment.Status == CommentStatus.Active),

                // ListContentIds — which of the user's lists contain this problem
                userId != null
                    ? data.problem.UserProblemListItems
                        .Where(item => item.List.UserId == userId)
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

        // Later pages narrow to the same set as the first, so their options would only repeat it
        var isFirstPage = bounds.PageNumber == 1;

        // The whole library's options, counted over every problem rather than over what the query leaves
        var baseOptions = isFirstPage && includeBaseOptions
            ? await BuildSearchOptionsAsync(dbContext.Problems, _everythingInPlay, _noTerms, language)
            : null;

        // The query's own options, worth counting only where they can differ from the library's.
        // Most facets are counted disjunctively, tags and authors conjunctively when AND is selected
        // alongside at least one of them.
        var updatedOptions = isFirstPage && NarrowsAnything(parameters, terms)
            ? await BuildSearchOptionsAsync(textFilteredQuery, parameters, terms, language)
            : null;

        // Return the complete filter result
        return new FilterResult(pagedResults, baseOptions, updatedOptions);
    }

    /// <summary>
    /// What one request narrows by beyond its facet criteria: the competitions its selection resolved to, and
    /// what the person asking narrowed to on top.
    /// </summary>
    /// <remarks>
    /// Every facet is counted by rerunning the filter with its own criteria varied, so these hold across each
    /// of those runs while the criteria change.
    /// </remarks>
    /// <param name="CompetitionIds">Every competition the selections resolve to, subtrees included.</param>
    /// <param name="FavoritesOnly"><inheritdoc cref="FilterQuery" path="/param[@name='FavoritesOnly']"/></param>
    /// <param name="ListContentId"><inheritdoc cref="FilterQuery" path="/param[@name='ListContentId']"/></param>
    /// <param name="MarkStatus"><inheritdoc cref="FilterQuery" path="/param[@name='MarkStatus']"/></param>
    /// <param name="UserId"><inheritdoc cref="ProblemFilterOptions" path="/param[@name='UserId']"/></param>
    private record FilterTerms(
        IReadOnlyCollection<Guid> CompetitionIds,
        bool FavoritesOnly,
        string? ListContentId,
        MarkStatusFilter? MarkStatus,
        Guid? UserId);

    /// <summary>
    /// Criteria that ask for the library whole. The logic toggles have no bearing without slugs beside them,
    /// so the value either carries is arbitrary.
    /// </summary>
    private static readonly FilterParameters _everythingInPlay = new(
        SearchText: "",
        SearchInSolution: false,
        OlympiadYears: [],
        CompetitionPaths: [],
        ProblemNumbers: [],
        TagSlugs: [],
        TagLogic: LogicToggle.Or,
        AuthorSlugs: [],
        AuthorLogic: LogicToggle.Or);

    /// <summary>
    /// Terms that narrow to nobody in particular, which is what counting the whole library asks for.
    /// </summary>
    private static readonly FilterTerms _noTerms = new([], FavoritesOnly: false, ListContentId: null,
        MarkStatus: null, UserId: null);

    /// <summary>
    /// Whether a query leaves any of the library out.
    /// </summary>
    /// <remarks>
    /// Each condition here is one the run narrows by: the search text ahead of <see cref="ApplyFilters"/>,
    /// the rest inside it. The two have to move together, since a filter applied without being named here
    /// would be counted as though it were never applied. A logic toggle and reaching into solutions narrow
    /// nothing on their own, which is why neither appears.
    /// </remarks>
    /// <param name="parameters">The criteria the query names.</param>
    /// <param name="terms"><inheritdoc cref="FilterTerms" path="/summary"/></param>
    /// <returns>Whether anything is filtered out.</returns>
    private static bool NarrowsAnything(FilterParameters parameters, FilterTerms terms) =>
        !string.IsNullOrWhiteSpace(parameters.SearchText)
        || parameters.OlympiadYears is { Count: > 0 }
        || parameters.CompetitionPaths is { Count: > 0 }
        || parameters.ProblemNumbers is { Count: > 0 }
        || parameters.TagSlugs is { Count: > 0 }
        || parameters.AuthorSlugs is { Count: > 0 }
        || terms.FavoritesOnly
        || terms.ListContentId is not null
        || terms.MarkStatus is not null;

    /// <summary>
    /// Applies all active filters to the base query based on user's selections.
    /// </summary>
    /// <param name="problems">Base queryable to apply filters to</param>
    /// <param name="parameters">Filter parameters containing user selections and search criteria</param>
    /// <param name="terms"><inheritdoc cref="FilterTerms" path="/summary"/></param>
    /// <returns>Filtered queryable with all applicable conditions applied</returns>
    private static IQueryable<Problem> ApplyFilters(
        IQueryable<Problem> problems,
        FilterParameters parameters,
        FilterTerms terms)
    {
        // Convenient deconstruct
        var (competitionIds, favoritesOnly, listContentId, markStatus, userId) = terms;

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

                // The check above already narrowed to the whole enum, and only an undeclared value gets here
                _ => throw new UnreachableException()
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

        // If competitions are specified..
        if (parameters.CompetitionPaths is { Count: > 0 })
        {
            // Keep the problems sitting anywhere under one of them, which is what the resolved ids stand for
            problems = problems.Where(problem => competitionIds.Contains(problem.Round.CompetitionId));
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

                // Nothing else is a way to combine tags
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

                // Nothing else is a way to combine authors
                default:
                    throw new ArgumentOutOfRangeException(nameof(parameters), parameters.AuthorLogic, "Invalid author logic option");
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
    /// <param name="terms"><inheritdoc cref="FilterTerms" path="/summary"/></param>
    /// <param name="language">The language to use for facet labels and search options</param>
    /// <returns>Complete search bar options with facet counts and metadata</returns>
    private async Task<SearchBarOptions> BuildSearchOptionsAsync(
        IQueryable<Problem> baseQuery,
        FilterParameters parameters,
        FilterTerms terms,
        Language language)
    {
        // Create facet-specific scopes by excluding each facet's own selections
        // This ensures counts reflect available options rather than current selections
        var seasonsScope = ApplyFilters(baseQuery, parameters with { OlympiadYears = [] }, terms);
        var problemNumbersScope = ApplyFilters(baseQuery, parameters with { ProblemNumbers = [] }, terms);
        var competitionsScope = ApplyFilters(baseQuery, parameters with { CompetitionPaths = [] }, terms);

        // For tags: use conjunctive counting when AND logic is selected with at least one tag
        // This shows "how many results if I add this tag" instead of "how many results are available"
        // Otherwise, use disjunctive counting (exclude selected tags)
        var tagsScope = parameters is { TagLogic: LogicToggle.And, TagSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, terms)
            : ApplyFilters(baseQuery, parameters with { TagSlugs = [] }, terms);

        // For authors: Analogous logic to that of with tags
        var authorsScope = parameters is { AuthorLogic: LogicToggle.And, AuthorSlugs.Count: > 0 }
            ? ApplyFilters(baseQuery, parameters, terms)
            : ApplyFilters(baseQuery, parameters with { AuthorSlugs = [] }, terms);

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
                    seasonGroup.StartYear
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
            .Select(tag => new TagFacetOption(
                tag.Slug,
                localization.GetTagName(language, tag.Slug),
                FullName: null,
                tag.Count,
                tag.TagType))
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
            .Select(author => new FacetOption(author.Slug, author.Name, FullName: null, author.Count))
            // Execute the query
            .ToListAsync();

        // Count the problems each competition holds, which is all the tree needs to be folded back up
        var competitionCounts = await CountByCompetitionAsync(competitionsScope);

        // The same competitions as the tree they actually form, each carrying its whole subtree's count
        var competitions = BuildCompetitionTree(competitionCounts, language);

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
    /// Names the season a problem was set in and the competition it belongs to, given as every competition down to it.
    /// </summary>
    /// <remarks>
    /// Static, and handed the localization service instead of reading the field, because the projection that
    /// calls it is an expression tree: an instance member puts this service in that tree as a constant, which
    /// EF refuses to compile.
    /// </remarks>
    /// <param name="localization">The resolver of localized display names.</param>
    /// <param name="editionNumber">The season's edition number.</param>
    /// <param name="startYear">The calendar year the season started.</param>
    /// <param name="competitionPath">The path of the competition the problem sits in.</param>
    /// <param name="number">The problem's number within its competition.</param>
    /// <param name="language">The language to label everything in.</param>
    /// <returns>The problem's source.</returns>
    private static ProblemSource BuildSource(
        IMetadataLocalizationService localization,
        int editionNumber,
        int startYear,
        string competitionPath,
        int number,
        Language language)
    {
        // The season, labelled from its own template.
        var season = new LabeledSlug(
            editionNumber.ToString(),
            localization.GetSeasonLabel(language, editionNumber, startYear));

        // The competition spelled out as every competition down to it, each addressed by its own path, which is what
        // its localized names are keyed by.
        var competition = CompetitionTree.Descend(competitionPath)
            .Select(node => new LabeledSlug(
                node.Path,
                localization.GetNodeShortName(language, node.Path),
                localization.GetNodeFullName(language, node.Path)))
            .ToImmutableList();

        // The three together pin the problem down: when it ran, what it ran in, and where in that.
        return new ProblemSource(season, competition, number);
    }

    /// <summary>
    /// One competition and how many problems of the current scope sit in it.
    /// </summary>
    /// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <param name="SortPath"><inheritdoc cref="Competition.SortPath" path="/summary"/></param>
    /// <param name="Count">How many problems it holds.</param>
    private record CompetitionCount(string Path, string SortPath, int Count);

    /// <summary>
    /// Counts the problems of a scope per competition. Problems hang off a competition at whatever depth it sits, so
    /// one group per competition is the finest split there is; every roll-up above it is a fold over these.
    /// </summary>
    /// <param name="scope">The problems to count.</param>
    /// <returns>One entry per competition holding at least one problem.</returns>
    private static async Task<List<CompetitionCount>> CountByCompetitionAsync(IQueryable<Problem> scope) =>
        [.. (await scope
            // Group by the competition the problems belong to, which its two paths identify and order
            .GroupBy(problem => new
            {
                problem.Round.Competition.Path,
                problem.Round.Competition.SortPath,
            })
            // Project to intermediate structure with counts
            .Select(competitionGroup => new
            {
                competitionGroup.Key.Path,
                competitionGroup.Key.SortPath,
                Count = competitionGroup.Count(),
            })
            // Execute the query
            .ToListAsync())
            // Wrap each into a counted competition
            .Select(competition => new CompetitionCount(competition.Path, competition.SortPath, competition.Count))];

    /// <summary>
    /// One competition on the chain down to a counted one — how the tree addresses it, and where it sits.
    /// </summary>
    /// <param name="ParentPath">The path of the competition one level up, null at a root one.</param>
    /// <param name="Path"><inheritdoc cref="Competition.Path" path="/summary"/></param>
    /// <param name="SortKey">Its zero-padded position among its siblings, which sorts as it reads.</param>
    private record CompetitionPlace(string? ParentPath, string Path, string SortKey);

    /// <summary>
    /// The competitions a counted competition hangs from, root-first, itself last. Its two paths spell out the same
    /// chain — the slugs down to it, and their sibling positions — so each competition on it takes its own path
    /// from the one and its position from the other.
    /// </summary>
    /// <param name="competition">The counted competition to walk down to.</param>
    /// <returns>One place per segment of its path.</returns>
    private static IEnumerable<CompetitionPlace> ChainOf(CompetitionCount competition)
    {
        // The sibling positions down to the competition, which pair up with its slugs index by index. Indexing
        // rather than zipping, so two paths of different depths fail loudly instead of yielding half a chain.
        var sortKeys = competition.SortPath.Split('.');

        // One place per segment, each taking the position its own generation is ordered by.
        return CompetitionTree.Descend(competition.Path)
            .Select((node, depth) => new CompetitionPlace(node.ParentPath, node.Path, sortKeys[depth]));
    }

    /// <summary>
    /// Folds counted competitions back into the tree they came from: every competition holding problems, and every
    /// competition above it, each carrying what its whole subtree holds. A competition nothing was counted under never
    /// appears, so the tree offers exactly what the current scope can still be narrowed to.
    /// </summary>
    /// <param name="competitions">The counted competitions, one per competition holding problems.</param>
    /// <param name="language">The language to label the competitions in.</param>
    /// <returns>The competitions, each carrying everything below it.</returns>
    private ImmutableList<CompetitionNodeOption> BuildCompetitionTree(
        IReadOnlyCollection<CompetitionCount> competitions,
        Language language)
    {
        // Each count landing on every competition on the chain down to it, since a competition's total is its whole
        // subtree's and not just what hangs off it directly
        var counted = competitions.SelectMany(competition =>
            ChainOf(competition).Select(place => (Place: place, competition.Count)));

        // The competitions to offer, totalled per competition and gathered under the one they hang from — a root
        // one under the null path, since nothing hangs above it
        var byParent = counted
            .GroupBy(entry => entry.Place, entry => entry.Count)
            .Select(group => (Place: group.Key, Count: group.Sum()))
            .ToLookup(total => total.Place.ParentPath);

        // Offers one generation, each competition carrying everything the fold left below it.
        ImmutableList<CompetitionNodeOption> Offer(string? parentPath) =>
            [.. byParent[parentPath]
                // Siblings read in the order the registry places them
                .OrderBy(total => total.Place.SortKey, StringComparer.Ordinal)
                // Each competition is named by its own path, and carries the generation below it
                .Select(total => new CompetitionNodeOption(
                    total.Place.Path,
                    localization.GetNodeShortName(language, total.Place.Path),
                    localization.GetNodeFullName(language, total.Place.Path),
                    total.Count,
                    Offer(total.Place.Path)))];

        // The competitions, which nothing hangs above
        return Offer(parentPath: null);
    }

    /// <summary>
    /// Resolves selected competition paths to every competition they cover: each selected node and everything below
    /// it, since selecting a competition means selecting the rounds inside it. A path naming a competition that
    /// isn't there resolves to nothing and so matches nothing.
    /// </summary>
    /// <param name="selectedPaths">The paths of the selected competitions, possibly none.</param>
    /// <returns>The ids of every covered competition.</returns>
    private async Task<IReadOnlyCollection<Guid>> ResolveCompetitionIdsAsync(ImmutableList<string> selectedPaths)
    {
        // Nothing selected means no lookup to do, and the filter skips the term entirely.
        if (selectedPaths.Count == 0)
            return [];

        // The whole tree, which is small enough to walk in memory.
        var competitions = await dbContext.Competitions.AsNoTracking()
            .Select(competition => new { competition.Id, competition.Path })
            .ToListAsync();

        // A competition is covered when it is selected itself or descends from something that is.
        return [.. competitions
            .Where(competition => selectedPaths.Any(selected => TaxonomySlugs.IsAtOrUnder(competition.Path, selected)))
            .Select(competition => competition.Id)];
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

        // Return one id per problem, since a problem matching in several of its texts is one row per text here
        return await textSearchQuery.Select(text => text.ProblemId).Distinct().ToListAsync();
    }

    /// <inheritdoc/>
    public async Task<SeasonCompetitionBrowserResult> GetCompetitionsBySeasonAsync(Language language)
    {
        // Group all problems by the season and the competition they belong to
        // We will then take only these data + problem count to build the result
        var competitionData = await dbContext.Problems
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
        var seasonGroups = competitionData
            // Group by season
            .GroupBy(data => new { data.EditionNumber, data.StartYear })
            // Order by newest first
            .OrderByDescending(group => group.Key.EditionNumber)
            // Create a season object for each group
            .Select(seasonGroup =>
            {
                // Build flattened competition list for this season with localized display names
                var competitions = seasonGroup
                    // Order down the tree, which takes each level in its registry order, however deep it runs
                    .OrderBy(group => group.SortPath, StringComparer.Ordinal)
                    .Select(group =>
                    {
                        // Every competition down to this one, named as it is shown, root-first
                        var labels = CompetitionTree.Descend(group.Path)
                            .Select(node => localization.GetNodeShortName(language, node.Path))
                            .ToImmutableList();

                        // Addressed by its path and named by its labels, at whatever depth it sits
                        return new CompetitionWithCount(group.Path, labels, group.ProblemCount);
                    });

                // Return season-specific data with localized label
                return new SeasonCompetitionsGroup(
                    seasonGroup.Key.EditionNumber,
                    localization.GetSeasonLabel(
                        language,
                        seasonGroup.Key.EditionNumber,
                        seasonGroup.Key.StartYear
                    ),
                    [.. competitions]
                );
            });

        // Build the result with all seasons
        return new SeasonCompetitionBrowserResult([.. seasonGroups]);
    }
}

