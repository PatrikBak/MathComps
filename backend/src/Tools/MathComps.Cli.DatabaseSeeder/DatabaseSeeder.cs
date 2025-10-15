using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using MathComps.TexParser.Types;
using Microsoft.EntityFrameworkCore;
using Spectre.Console;
using System.Collections.Immutable;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using EfProblem = MathComps.Domain.EfCoreEntities.Problem;

namespace MathComps.Cli.DatabaseSeeder;

/// <summary>
/// Orchestrates database seeding from a parsed problems dataset. Reads the input JSON,
/// maps to EF Core entities, and performs idempotent upserts.
/// </summary>
/// <param name="dbContext">The database context used for all data operations.</param>
public class DatabaseSeeder(MathCompsDbContext dbContext) : IDatabaseSeeder
{
    #region Helper types

    /// <summary>
    /// Represents a competition identifier parsed from the dataset. It is like a single 
    /// 'dat' of a competition, could be one day of the TST, the team round of MEMO,
    /// a school round of category C, etc.
    /// </summary>
    /// <param name="Category">The competition category (e.g., "A", "B", "C").</param>
    /// <param name="Competition">The competition identifier (e.g., "I", "II", "MEMO") as used in parsed problems.</param>
    /// <param name="Subcompetition">Optional subcompetition identifier (e.g., "T" for team).</param>
    private record CompetitionRoundId(
        string? Category,
        string Competition,
        string? Subcompetition
    );

    /// <summary>
    /// Contains resolved (competition, round) data for database operations. For example for
    /// MEMO, we will have two entries: one for the individual round one for the team round
    /// (with Round data).
    /// </summary>
    /// <param name="CompetitionId">The canonical competition id.</param>
    /// <param name="CompetitionOrder">Sort order for the competition.</param>
    /// <param name="Round">Round data if the competition has rounds, null otherwise.</param>
    /// <param name="Category">The category associated with this specific competition round configuration.</param>
    private record CompetitionRoundData(
        string CompetitionId,
        int CompetitionOrder,
        RoundData? Round,
        string? Category
    );

    /// <summary>
    /// Represents round data for competitions that have multiple rounds. In practice, 
    /// it is for one day of a multi-day competition, or a team round vs. individual round.
    /// </summary>
    /// <param name="RoundId">The id of the round.</param>
    /// <param name="DisplayName"><inheritdoc cref="Round.DisplayName" path="/summary"/></param>
    /// <param name="FullName"><inheritdoc cref="Round.FullName" path="/summary"/></param>
    /// <param name="RoundOrder"><inheritdoc cref="Round.SortOrder" path="/summary"/></param>
    private record RoundData(
        string RoundId,
        int RoundOrder,
        string DisplayName,
        string? FullName = null
    );

    /// <summary>
    /// Contains all unique metadata entities extracted from the problems dataset.
    /// </summary>
    /// <param name="CompetitionRounds">All unique competitions found in the dataset.</param>
    /// <param name="Seasons">All unique seasons (start years) found in the dataset.</param>
    /// <param name="RoundInstances">All unique competition-season combinations found in the dataset.</param>
    private record MetadataExtractionResult(
        ImmutableList<CompetitionRoundData> CompetitionRounds,
        ImmutableList<string> Categories,
        ImmutableList<int> Seasons,
        ImmutableList<(CompetitionRoundData Competition, int StartYear)> RoundInstances
    );

    #endregion

    #region Fields

    /// <summary>
    /// The base year for the Mathematical Olympiad, from which edition numbers are calculated.
    /// The raw dataset uses an `OlympiadYear` property, which is an offset from this base year.
    /// </summary>
    private const int OlympiadBaseYear = 1950;

    /// <summary>
    /// Centralized JSON serialization options for persisting parsed statement/solution to
    /// PostgreSQL <c>jsonb</c> columns.
    /// </summary>
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        // Use compact representation without extra whitespace.
        WriteIndented = false,

        // Use camelCase for property names to match JavaScript conventions.
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,

        // Ignore null values to reduce storage size.
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

        // Enum values so JS clients can read them as strings.
        Converters = { new JsonStringEnumConverter() },
    };

    #endregion

    #region Public Methods

    /// </<inheritdoc/>
    public async Task SeedAsync(bool skipExistingProblems)
    {
        // Log start
        AnsiConsole.MarkupLine("[bold cyan]Starting database seeding process...[/]");

        // Make aware of the update mode
        if (skipExistingProblems)
            AnsiConsole.MarkupLine("[yellow]Existing problems will not be checked for updated[/]");

        #region Load problems

        // Get the path for the parsed archive data
        var jsonPath = Path.Combine("../../../../", SkmoDataPaths.SkmoParsedArchiveFile);

        // The file must exist, throw exception if not found.
        if (!File.Exists(jsonPath))
            throw new FileNotFoundException("Input JSON file not found", Path.GetFullPath(jsonPath));

        // Read the entire JSON content with a spinner
        var jsonContent = await File.ReadAllTextAsync(jsonPath);

        // Deserialize into a list of parsed problems.
        var parsedProblems = JsonSerializer.Deserialize<ImmutableList<SkmoParsedProblem>>(jsonContent)
            // This must not be null if the file is valid JSON.
            ?? throw new InvalidOperationException("Failed to deserialize the input JSON file.");

        // Log the number of problems found
        AnsiConsole.MarkupLine($"[green]Loaded {parsedProblems.Count:N0} problems from dataset[/]");

        #endregion

        #region Ensure competitions exist

        // Scan all problems to find unique competitions, seasons, etc.
        var metadataExtractionResult = ExtractMetadataFromProblems(parsedProblems);

        // Create all competitions, seasons, rounds...
        await EnsureMetadataEntitiesExistAsync(metadataExtractionResult);

        // Save all metadata entities in one batch.
        await dbContext.SaveChangesAsync();

        // Author are loaded as original entites
        var authors = await dbContext.Authors.AsNoTracking().ToDictionaryAsync(author => author.Slug);

        // We also need some usefu ids
        var seasonIds = await dbContext.Seasons.ToDictionaryAsync(season => season.StartYear, season => season.Id);
        var competitionIds = await dbContext.Competitions.ToDictionaryAsync(competition => competition.Slug, competition => competition.Id);
        var categoryIds = await dbContext.Categories.ToDictionaryAsync(category => category.Slug, category => category.Id);
        var roundInstanceIds = await dbContext.RoundInstances.ToDictionaryAsync(instance => (instance.RoundId, instance.SeasonId), instance => instance.Id);

        // From rounds we need composite slugs (for creation of problem slugs) and id
        var allRoundData = await dbContext.Rounds.ToDictionaryAsync(round =>
            // A competition, round, category is a unique triple
            (round.CompetitionId, round.Slug, round.CategoryId),
            // Fetch slug + id
            round => new { round.CompositeSlug, RoundId = round.Id }
        );

        #endregion

        #region Save problems

        // Track inserts vs. updates vs. skipped for a concise summary at the end.
        var insertedProblems = 0;
        var updatedProblems = 0;
        var unchangedProblems = 0;

        // Track all problem slugs we process from the file for orphan detection later.
        var processedProblemSlugs = new HashSet<string>();

        // Preload all existing problem identifiers for fast in-memory lookups when skipping existing problems.
        // This eliminates thousands of individual database queries during the seeding process.
        var problemsToSkip = !skipExistingProblems ? null :
            // Problems are simply idenfied by a round instance (a round in a year) and its number within
            await dbContext.Problems
                .Select(problem => new ValueTuple<Guid, int>(problem.RoundInstanceId, problem.Number))
                .ToHashSetAsync();

        // Log preloaded count if we have them
        if (problemsToSkip is not null)
            AnsiConsole.MarkupLine($"\n[green]Loaded {problemsToSkip.Count:N0} existing problem identifiers for skip mode[/]");

        // Use a progress bar for the overall seeding process
        await AnsiConsole.Progress()
            .AutoClear(enabled: true)
            .Columns(
            [
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new SpinnerColumn(),
            ])
            .StartAsync(async context =>
            {
                // Process problems with individual progress tracking
                var problemsTask = context.AddTask("[green]Processing individual problems[/]", maxValue: parsedProblems.Count);
                problemsTask.StartTask();

                // Handle problems sequentially.
                for (var i = 0; i < parsedProblems.Count; i++)
                {
                    // Get the current problem
                    var parsedProblem = parsedProblems[i];

                    // Update task description to show current problem
                    problemsTask.Description = $"[green]Processing problem {i + 1:N0} of {parsedProblems.Count:N0}[/] [dim]({parsedProblem.RawProblem.Id})[/]";

                    #region Gather problem data

                    // Resolve competition and round data from the dataset identifiers.
                    var competitionRoundData = GetRoundData(new CompetitionRoundId(
                        parsedProblem.RawProblem.Category,
                        parsedProblem.RawProblem.Competition,
                        parsedProblem.RawProblem.Subcompetition
                    ));

                    // Figure out the real start year
                    var startYear = parsedProblem.RawProblem.OlympiadYear + OlympiadBaseYear;

                    // Get some useful ids from cache 
                    var seasonId = seasonIds[startYear];
                    var competitionId = competitionIds[competitionRoundData.CompetitionId.ToSlug()];

                    // Get category id from cache if a problem belongs to any
                    var categoryId = parsedProblem.RawProblem.Category is null ? (Guid?)null : categoryIds[parsedProblem.RawProblem.Category.ToSlug()];

                    // We can get to rounds now
                    var roundData = allRoundData[(competitionId, competitionRoundData.Round?.RoundId.ToSlug() ?? "", categoryId)];

                    // Round instance
                    var roundInstanceId = roundInstanceIds[(roundData.RoundId, seasonId)];

                    // The slug should be unique and nice in an URL
                    var problemSlug = $"{parsedProblem.RawProblem.OlympiadYear}-{roundData.CompositeSlug}-{parsedProblem.RawProblem.Order}";

                    // Track this problem slug for orphan detection later.
                    processedProblemSlugs.Add(problemSlug);

                    #endregion

                    #region Handle problem skipping

                    // If we even want to just skip them and this one is to be skipped, do so
                    if (problemsToSkip is not null && problemsToSkip.Contains((roundInstanceId, parsedProblem.RawProblem.Order)))
                    {
                        // Leave this problem alone
                        unchangedProblems++;

                        // Carry on
                        continue;
                    }

                    #endregion

                    #region Handle images

                    // Create the common metadata for image processing
                    var problemImageMetadata = new ProblemImageProcessor.ProblemMetadata(problemSlug, parsedProblem.RawProblem.OlympiadYear);

                    // Process images: copy them to a public location, update the parsed content,
                    // and gather the physical image data to be saved to the database.
                    var statementProcessingResult = ProblemImageProcessor.Process(parsedProblem.ParsedStatement, problemImageMetadata);
                    var solutionProcessingResult = ProblemImageProcessor.Process(parsedProblem.ParsedSolution, problemImageMetadata);

                    // Update the parsed problem with the new data
                    parsedProblem = parsedProblem with
                    {
                        ParsedStatement = statementProcessingResult.ProcessedText,
                        ParsedSolution = solutionProcessingResult.ProcessedText,
                    };

                    // Merge the images from the problem and the statement
                    var discoveredImages = statementProcessingResult.DiscoveredImages.AddRange(solutionProcessingResult.DiscoveredImages);

                    #endregion

                    // Upsert authors — ensure all authors exist and preserve their original order.
                    var problemAuthors = await UpsertAuthorsAsync(parsedProblem.RawProblem.Authors, authors);

                    // Get round instance id from cache 
                    var (inserted, updated, skipped) = await UpsertProblemWithAuthorsAndImagesAsync(
                        parsedProblem,
                        problemSlug,
                        roundInstanceId,
                        problemAuthors,
                        discoveredImages
                    );

                    // Tally results.
                    insertedProblems += inserted;
                    updatedProblems += updated;
                    unchangedProblems += skipped;

                    // Save changes after each problem to trigger immediate constraints checking
                    if (inserted > 0 || updated > 0)
                        await dbContext.SaveChangesAsync();

                    // Update progress
                    problemsTask.Increment(1);
                }

                // Problems are done
                problemsTask.StopTask();
            });

        #endregion

        #region Handle orphaned problems

        // Find problems in the database that are no longer in the JSON file.
        var orphanedProblemSlugs = (await dbContext.Problems
            // Slug as an id
            .Select(problem => problem.Slug)
            // Evaluate
            .ToListAsync())
            // Take only problems that have not been in the processed 
            .Where(slug => !processedProblemSlugs.Contains(slug))
            // Order nicely
            .Order().ToList();

        // Track how many problems were deleted
        var deletedProblems = 0;

        // If there are orphaned problems...
        if (orphanedProblemSlugs.Count > 0)
        {
            // Inform
            AnsiConsole.WriteLine();
            AnsiConsole.MarkupLine($"[yellow]Found {orphanedProblemSlugs.Count} orphaned problem(s) in the database that are no longer in the JSON file:[/]");

            // At most this many to show
            const int maxProblemsToShow = 20;

            // Exactly how many we'll show
            var samplesToShow = Math.Min(maxProblemsToShow, orphanedProblemSlugs.Count);

            // Show each sample
            for (var i = 0; i < samplesToShow; i++)
                AnsiConsole.MarkupLine($"[dim] - {orphanedProblemSlugs[i]}[/]");

            // Show ellipsis if too many
            if (orphanedProblemSlugs.Count > maxProblemsToShow)
                AnsiConsole.MarkupLine($"[dim] ... and {orphanedProblemSlugs.Count - maxProblemsToShow} more[/]");

            // End list
            AnsiConsole.WriteLine();

            // A good idea to ask for a confirmation
            var shouldDelete = AnsiConsole.Confirm(
                "[red]Do you want to delete these orphaned problems from the database?[/]",
                defaultValue: false);

            // If we deleting
            if (shouldDelete)
            {
                // Delete orphaned problems; cascade delete will automatically handle related records
                // (problem images, problem authors, problem-tag links, and problem similarities).
                deletedProblems = await dbContext.Problems
                    .Where(problem => orphanedProblemSlugs.Contains(problem.Slug))
                    .ExecuteDeleteAsync();
            }
            // No delete
            else AnsiConsole.MarkupLine("\n[blue]Skipped deletion of orphaned problems[/]");
        }

        #endregion

        // Summary.
        AnsiConsole.MarkupLine(
            "\n[cyan]Problems:[/]\n" +
             $"[green] - Inserted:  {insertedProblems} problems[/]\n" +
            $"[yellow] - Updated:   {updatedProblems} problems[/]\n" +
              $"[blue] - Unchanged: {unchangedProblems} problems[/]\n" +
               $"[red] - Deleted:   {deletedProblems} problems[/]");
    }

    #endregion

    #region Metadata Extraction and Bulk Creation

    /// <summary>
    /// Extracts all unique metadata (competitions, seasons, rounds, round instances) from the problems dataset.
    /// </summary>
    /// <param name="parsedProblems">The collection of parsed problems to analyze.</param>
    /// <returns>A result containing all unique metadata entities that need to exist.</returns>
    private static MetadataExtractionResult ExtractMetadataFromProblems(ImmutableList<SkmoParsedProblem> parsedProblems)
    {
        // Resolved round data
        var uniqueCompetitionRounds = new Dictionary<CompetitionRoundId, CompetitionRoundData>();
        var uniqueSeasons = new HashSet<int>();
        var uniqueCategories = new HashSet<string>();
        var uniqueRoundInstance = new HashSet<(CompetitionRoundData Competition, int StartYear)>();

        // Iterate through every problem to gather its associated metadata.
        foreach (var parsedProblem in parsedProblems)
        {
            try
            {
                // Extract competition 
                var competitionRoundId = new CompetitionRoundId(
                    parsedProblem.RawProblem.Category,
                    parsedProblem.RawProblem.Competition,
                    parsedProblem.RawProblem.Subcompetition);

                // Extract round
                var competitionRoundData = GetRoundData(competitionRoundId);

                // Track unique competition.
                uniqueCompetitionRounds.TryAdd(competitionRoundId, competitionRoundData);

                // Track unique category if any
                if (parsedProblem.RawProblem.Category is not null)
                    uniqueCategories.Add(parsedProblem.RawProblem.Category);

                // Find the real start year, olympiad year is an edition
                var startYear = parsedProblem.RawProblem.OlympiadYear + OlympiadBaseYear;

                // Track unique season.
                uniqueSeasons.Add(startYear);

                // Track unique round instance (a round in a season).
                uniqueRoundInstance.Add((competitionRoundData, startYear));
            }
            catch (Exception ex)
            {
                // Log and rethrow to fail fast if any problem has invalid identifiers.
                throw new InvalidOperationException($"Failed to extract metadata for problem ID '{parsedProblem.RawProblem.Id}': {ex.Message}", ex);
            }
        }

        // Return all collected unique metadata in an organized structure.
        return new MetadataExtractionResult(
            [.. uniqueCompetitionRounds.Values],
            [.. uniqueCategories],
            [.. uniqueSeasons],
            [.. uniqueRoundInstance]);
    }

    /// <summary>
    /// Ensures all metadata entities (competitions, seasons, rounds, round instances) exist in the database.
    /// Creates missing entities and updates existing ones as needed.
    /// </summary>
    /// <param name="metadata">The extracted metadata from problems analysis.</param>
    private async Task EnsureMetadataEntitiesExistAsync(MetadataExtractionResult metadata)
    {
        // Create all competitions first.
        await EnsureCompetitionsExistAsync(metadata.CompetitionRounds);

        // Create all categories that are referenced by competitions.
        await EnsureCategoriesExistAsync(metadata.Categories);

        // Save so they have competition and category IDs for rounds.
        await dbContext.SaveChangesAsync();

        // Create all seasons.
        await EnsureSeasonsExistAsync(metadata.Seasons);

        // Create all rounds (depends on competitions).
        await EnsureRoundsExistAsync(metadata.CompetitionRounds);

        // Save seasons so they have IDs for round instances.
        await dbContext.SaveChangesAsync();

        // Create all round instances (depends on round and seasons).
        await EnsureRoundInstancesExistAsync(metadata.RoundInstances);
    }

    /// <summary>
    /// Ensures all required competitions exist in the database with up-to-date properties.
    /// Creates new competition entities for any competitions that don't exist, and updates
    /// existing ones if their properties have changed.
    /// </summary>
    /// <param name="competitions">The list of (competition, round) data extracted from the problems dataset.</param>
    private async Task EnsureCompetitionsExistAsync(ImmutableList<CompetitionRoundData> competitions)
    {
        // Fetch all existing competitions from the database
        var existingCompetitions = await dbContext.Competitions.ToDictionaryAsync(competition => competition.Slug);

        // Extract unique competitions from the dataset
        var uniqueCompetitions = competitions
            .Select(competitionRound => (competitionRound.CompetitionId, competitionRound.CompetitionOrder))
            .Distinct()
            .ToList();

        // Track changes for logging
        var insertedCount = 0;
        var updatedCount = 0;

        // Process each competition
        foreach (var (competitionId, competitionOrder) in uniqueCompetitions)
        {
            // The slugs are extracted from SKMO ids
            var competitionSlug = competitionId.ToSlug();

            // Find the nice names for the UI
            var (displayName, fullName) = GetCompetitionNames(competitionSlug);

            // Check if competition already exists
            if (existingCompetitions.TryGetValue(competitionSlug, out var existingCompetition))
            {
                // Any property change?
                var hasChanges =
                    existingCompetition.DisplayName != displayName ||
                    existingCompetition.FullName != fullName ||
                    existingCompetition.SortOrder != competitionOrder;

                // Count it if so
                updatedCount += hasChanges ? 1 : 0;

                // Update all properties, ef will manage
                existingCompetition.DisplayName = displayName;
                existingCompetition.FullName = fullName ?? displayName;
                existingCompetition.SortOrder = competitionOrder;
            }
            else
            {
                // Create new competition
                await dbContext.Competitions.AddAsync(new Competition
                {
                    DisplayName = displayName,
                    FullName = fullName ?? displayName,
                    Slug = competitionSlug,
                    SortOrder = competitionOrder,
                });

                // Count it in
                insertedCount++;
            }
        }

        // Log results summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Competitions:[/]\n" +
            $"[green] - Inserted {insertedCount}[/]\n" +
            $"[yellow] - Updated {updatedCount}[/]\n" +
            $"[blue] - Unchanged {existingCompetitions.Count - updatedCount}[/]");
    }

    /// <summary>
    /// Ensures all required categories exist in the database with up-to-date properties.
    /// Creates new category entities for any categories that don't exist, and updates
    /// existing ones if their properties have changed.
    /// </summary>
    /// <param name="categoryNames">The list of all category names extracted from the problems dataset.</param>
    private async Task EnsureCategoriesExistAsync(ImmutableList<string> categoryNames)
    {
        // Fetch all existing categories from the database
        var existingCategories = await dbContext.Categories.ToDictionaryAsync(category => category.Slug);

        // Track changes for logging
        var insertedCount = 0;
        var updatedCount = 0;

        // Process each category
        foreach (var categoryName in categoryNames.Distinct())
        {
            // The slugs are extracted from SKMO ids
            var categorySlug = categoryName.ToSlug();

            // A helper will find the sort order
            var categorySortOrder = GetCategorySortOrder(categoryName);

            // Check if category already exists
            if (existingCategories.TryGetValue(categorySlug, out var existingCategory))
            {
                // Any property change?
                var hasChanges =
                    existingCategory.Name != categoryName ||
                    existingCategory.SortOrder != categorySortOrder;

                // Count it if so
                updatedCount += hasChanges ? 1 : 0;

                // Do the update of all properties, EF will figure out changes
                existingCategory.Name = categoryName;
                existingCategory.SortOrder = categorySortOrder;
            }
            else
            {
                // Create new category
                await dbContext.Categories.AddAsync(new Category
                {
                    Name = categoryName,
                    Slug = categorySlug,
                    SortOrder = categorySortOrder,
                });

                // Count it in
                insertedCount++;
            }
        }

        // Log results summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Categories:[/]\n" +
            $"[green] - Inserted {insertedCount}[/]\n" +
            $"[yellow] - Updated {updatedCount}[/]\n" +
            $"[blue] - Unchanged {existingCategories.Count - updatedCount}[/]");
    }

    /// <summary>
    /// Ensures all required rounds exist in the database with up-to-date properties.
    /// Creates new round entities for any rounds that don't exist, and updates
    /// existing ones if their properties have changed.
    /// </summary>
    /// <param name="competitions">The list of (competition, round) data extracted from the problems dataset.</param>
    private async Task EnsureRoundsExistAsync(ImmutableList<CompetitionRoundData> competitions)
    {
        // Rounds have a competition id in their primary key, so we need to fetch all competitions first.
        var competitionSlugToId = await dbContext.Competitions
            .ToDictionaryAsync(competition => competition.Slug, competition => competition.Id);

        // Rounds may have a category id in their primary key, so we need to fetch all categories first.
        var categories = await dbContext.Categories.AsNoTracking()
            .ToDictionaryAsync(category => category.Slug, category => category.Id);

        // Fetch all existing rounds with their full data for updates
        var existingRounds = await dbContext.Rounds
            .ToDictionaryAsync(round => (round.CompetitionId, round.CategoryId, round.Slug));

        // Track changes for logging
        var insertedCount = 0;
        var updatedCount = 0;

        // Process each round
        foreach (var data in competitions)
        {
            // Find the competition id
            var competitionId = competitionSlugToId[data.CompetitionId.ToSlug()];

            // Find the category id, might be null
            var categoryId = data.Category != null ? categories[data.Category.ToSlug()] : (Guid?)null;

            // Find the round slug, might be empty (for default rounds)
            var roundSlug = data.Round?.RoundId.ToSlug() ?? "";

            // This slug combines competition, category and round into a single unique round-slug
            var compositeSlug = $"{data.CompetitionId}{(data.Category != null ? $"-{data.Category}" : "")}{(data.Round != null ? $"-{data.Round.RoundId}" : "")}".ToSlug();

            // Rounds have names unless they're 'default'
            var displayName = data.Round?.DisplayName ?? "";
            var fullName = data.Round?.FullName ?? data.Round?.DisplayName ?? "";

            // The round order is provided, unless we have a default round where it don't matter conceptually
            var sortOrder = data.Round?.RoundOrder ?? 1;

            // Setup if it's a default round
            var isDefault = data.Round is null;

            // Check if round already exists
            if (existingRounds.TryGetValue((competitionId, categoryId, roundSlug), out var existingRound))
            {
                // Any property change?
                var hasChanges =
                    existingRound.CompositeSlug != compositeSlug ||
                    existingRound.DisplayName != displayName ||
                    existingRound.FullName != fullName ||
                    existingRound.SortOrder != sortOrder ||
                    existingRound.IsDefault != isDefault;

                // Count it if so
                updatedCount += hasChanges ? 1 : 0;

                // Do the update of all properties, EF will figure out changes
                existingRound.CompositeSlug = compositeSlug;
                existingRound.DisplayName = displayName;
                existingRound.FullName = fullName;
                existingRound.SortOrder = sortOrder;
                existingRound.IsDefault = isDefault;
            }
            else
            {
                // Create new round
                await dbContext.Rounds.AddAsync(new Round
                {
                    CompetitionId = competitionId,
                    CategoryId = categoryId,
                    Slug = roundSlug,
                    CompositeSlug = compositeSlug,
                    DisplayName = displayName,
                    FullName = fullName,
                    SortOrder = sortOrder,
                    IsDefault = isDefault,
                });

                // Count it in
                insertedCount++;
            }
        }

        // Log results summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Rounds:[/]\n" +
            $"[green] - Inserted {insertedCount}[/]\n" +
            $"[yellow] - Updated {updatedCount}[/]\n" +
            $"[blue] - Unchanged {existingRounds.Count - updatedCount}[/]");
    }

    /// <summary>
    /// Ensures all required seasons exist in the database with up-to-date properties.
    /// Creates new season entities for any seasons that don't exist, and updates
    /// existing ones if their properties have changed.
    /// </summary>
    /// <param name="startYears">The list of season start years extracted from the problems dataset.</param>
    private async Task EnsureSeasonsExistAsync(ImmutableList<int> startYears)
    {
        // Fetch all existing seasons from the database
        var existingSeasons = await dbContext.Seasons.ToDictionaryAsync(season => season.StartYear);

        // Track changes for logging
        var insertedCount = 0;
        var updatedCount = 0;

        // Process each season
        foreach (var startYear in startYears.Distinct())
        {
            // Slovak numbering ftw
            var editionNumber = startYear - OlympiadBaseYear;

            // Slovak names ftw
            var editionLabel = $"{editionNumber}. ročník";

            // Check if season already exists
            if (existingSeasons.TryGetValue(startYear, out var existingSeason))
            {
                // Any property change?
                var hasChanges =
                    existingSeason.EditionNumber != editionNumber ||
                    existingSeason.EditionLabel != editionLabel;

                // Count it if so
                updatedCount += hasChanges ? 1 : 0;

                // Do the update of all properties, EF will figure out changes
                existingSeason.EditionNumber = editionNumber;
                existingSeason.EditionLabel = editionLabel;
            }
            else
            {
                // Create new season
                await dbContext.Seasons.AddAsync(new Season
                {
                    StartYear = startYear,
                    EditionNumber = editionNumber,
                    EditionLabel = editionLabel,
                });

                // Count it in
                insertedCount++;
            }
        }

        // Log results summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Seasons:[/]\n" +
            $"[green] - Inserted {insertedCount}[/]\n" +
            $"[yellow] - Updated {updatedCount}[/]\n" +
            $"[blue] - Unchanged {existingSeasons.Count - updatedCount}[/]");
    }

    /// <summary>
    /// Ensures all required round instances exist in the database.
    /// </summary>
    /// <param name="instances">The list of competition-season pairs extracted from the problems dataset.</param>
    private async Task EnsureRoundInstancesExistAsync(ImmutableList<(CompetitionRoundData Round, int StartYear)> instances)
    {
        // There's so much fetching of all entities here but it don't matter because there's just so little data...

        // To find new instances, we need existing ones... identified by (Round, Season).
        var existingInstances = await dbContext.RoundInstances
            // We only need what makes a round instance a round
            .Select(instance => new
            {
                RoundId = instance.Round.Id,
                SeasonId = instance.Season.Id,
            })
            // Should be all distinct
            .ToHashSetAsync();

        // We'll need round ids to create instances, so fetch all rounds first.
        var roundKeyToId = await dbContext.Rounds.ToDictionaryAsync(
            // This should identify a round                
            round => new
            {
                CompetitionSlug = round.Competition.Slug,
                CategorySlug = round.Category?.Slug ?? "",
                RoundSlug = round.Slug
            },
            // We need to use roiund ids
            roundData => roundData.Id);

        // We'll need season ids to create instances, so fetch all seasons first.
        var seasonStartYearToId = await dbContext.Seasons
            // The start year should be unique
            .ToDictionaryAsync(season => season.StartYear, season => season.Id);

        // Create new round instances
        var newInstances = instances
            // Create the final entity for each new instance.
            .Select(pair => new RoundInstance
            {
                // These data should exist because we ensured comps, categories and rounds exist
                RoundId = roundKeyToId[new
                {
                    CompetitionSlug = pair.Round.CompetitionId.ToSlug(),
                    CategorySlug = pair.Round.Category?.ToSlug() ?? "",
                    RoundSlug = pair.Round.Round?.RoundId.ToSlug() ?? "",
                }],

                // And we also ensured existing seasons
                SeasonId = seasonStartYearToId[pair.StartYear],
            })
            // Get rid of already created round instances
            .Where(roundInstancee => !existingInstances.Contains(new
            {
                roundInstancee.RoundId,
                roundInstancee.SeasonId,
            }))
            // In-memory evaluation
            .ToList();

        // Ensure the new instances are added
        await dbContext.RoundInstances.AddRangeAsync(newInstances);

        // Log results summary
        AnsiConsole.MarkupLine(
            $"\n[cyan]Round instances:[/]\n" +
            $"[green] - Inserted {newInstances.Count}[/]\n" +
            $"[blue] - Unchanged {existingInstances.Count}[/]");
    }

    #endregion

    #region Private Upsert Methods

    /// <summary>
    /// Ensures all authors exist (creating as needed) and returns them in the provided order.
    /// Uses an in-memory cache to avoid repeated database queries for the same author.
    /// Maintains the original order of authors as specified in the dataset.
    /// </summary>
    /// <param name="authorNames">The list of author names in the desired order.</param>
    /// <param name="authorsCache">An in-memory cache of existing authors for performance optimization.</param>
    /// <returns>A list of author entities in the same order as the input names.</returns>
    private async Task<List<Author>> UpsertAuthorsAsync(
        ImmutableList<string> authorNames,
        IDictionary<string, Author> authorsCache)
    {
        // Prepare a list to hold the resolved author entities, preserving order.
        var result = new List<Author>(capacity: authorNames.Count);

        // Iterate through the author names to find or create each one.
        foreach (var authorName in authorNames)
        {
            // Make the slug out of the name
            var authorSlug = authorName.ToSlug();

            // Check cache first for performance.
            if (!authorsCache.TryGetValue(authorSlug, out var resolvedAuthor))
            {
                // If not cached, check database.
                var existingAuthor = await dbContext.Authors.FirstOrDefaultAsync(author => author.Slug == authorSlug);

                // If found in the database
                if (existingAuthor is not null)
                {
                    // Use the existing entity.
                    resolvedAuthor = existingAuthor;
                }
                // If not in database
                else
                {
                    // Create a new author.
                    resolvedAuthor = new Author { Name = authorName, Slug = authorSlug };

                    // Explicitly add to the context for tracking
                    await dbContext.Authors.AddAsync(resolvedAuthor);
                }

                // Cache the found or new author to prevent future queries for the same person.
                authorsCache[authorSlug] = resolvedAuthor;
            }

            // Add the resolved author to the result list.
            result.Add(resolvedAuthor);
        }

        // The result list maintains the original author order from the dataset.
        return result;
    }

    /// <summary>
    /// Upserts a problem by a stable slug. Handles its images and authors as well. 
    /// </summary>
    /// <param name="parsedProblem">The parsed problem data from the dataset.</param>
    /// <param name="problemSlug">The unique human-readable problem id useful in URLs.</param>
    /// <param name="roundInstanceId">The id of the round instance this problem belongs to.</param>
    /// <param name="orderedAuthors">The list of authors in the correct order.</param>
    /// <param name="images">The list of physical images associated with this problem.</param>
    /// <returns>A tuple indicating the number of problems inserted, updated, and skipped.</returns>
    private async Task<(int inserted, int updated, int skipped)> UpsertProblemWithAuthorsAndImagesAsync(
        SkmoParsedProblem parsedProblem,
        string problemSlug,
        Guid roundInstanceId,
        List<Author> orderedAuthors,
        ImmutableList<ProblemImageData> images)
    {
        // Try to fetch this problem for update logic...
        var existingProblem = await dbContext.Problems.SingleOrDefaultAsync(problem =>
            // Should be a unique problem in a given round instance
            problem.RoundInstanceId == roundInstanceId && problem.Number == parsedProblem.RawProblem.Order);

        // Serialize the parsed statement and solution into JSON for storage in PostgreSQL jsonb columns.
        var serializedStatement = JsonSerializer.Serialize(parsedProblem.ParsedStatement, _jsonOptions);
        var serializedSolution = JsonSerializer.Serialize(parsedProblem.ParsedSolution, _jsonOptions);

        // If a problem don't exist...
        if (existingProblem is null)
        {
            // We create a new one.
            var newProblem = new EfProblem
            {
                Number = parsedProblem.RawProblem.Order,
                Statement = parsedProblem.RawProblem.Statement,
                StatementParsed = serializedStatement,
                Solution = parsedProblem.RawProblem.Solution,
                SolutionParsed = serializedSolution,
                RoundInstanceId = roundInstanceId,
                Slug = problemSlug
            };

            // Remember it
            await dbContext.Problems.AddAsync(newProblem);

            // Handle author
            for (var authorIndex = 0; authorIndex < orderedAuthors.Count; authorIndex++)
            {
                // Each of them with 1-based indexing
                await dbContext.ProblemAuthors.AddAsync(new ProblemAuthor
                {
                    ProblemId = newProblem.Id,
                    AuthorId = orderedAuthors[authorIndex].Id,
                    Ordinal = authorIndex + 1,
                });
            }

            // Add the images
            await dbContext.ProblemImages.AddRangeAsync(images.Select(image => new ProblemImage
            {
                ContentId = image.ContentId,
                Width = image.Width,
                Height = image.Height,
                Scale = image.Scale,
                ProblemId = newProblem.Id,
            }));

            // We're done with one insert
            return (inserted: 1, updated: 0, skipped: 0);
        }
        else
        {
            // Manually check for changes before updating (EF Core change tracking is unreliable with JSON fields).
            var problemChanged =
                existingProblem.Number != parsedProblem.RawProblem.Order ||
                existingProblem.Statement != parsedProblem.RawProblem.Statement ||
                existingProblem.Solution != parsedProblem.RawProblem.Solution ||
                existingProblem.RoundInstanceId != roundInstanceId ||
                existingProblem.Slug != problemSlug ||
                GeneralUtilities.JsonEquals(existingProblem.StatementParsed, serializedStatement) ||
                GeneralUtilities.JsonEquals(existingProblem.SolutionParsed, serializedSolution);

            // Update all properties
            existingProblem.Number = parsedProblem.RawProblem.Order;
            existingProblem.Statement = parsedProblem.RawProblem.Statement;
            existingProblem.Solution = parsedProblem.RawProblem.Solution;
            existingProblem.RoundInstanceId = roundInstanceId;
            existingProblem.Slug = problemSlug;
            existingProblem.StatementParsed = serializedStatement;
            existingProblem.SolutionParsed = serializedSolution;

            #region Handle Authors

            // Parse the relevant data of the authors
            var desiredAuthors = orderedAuthors
                .Select((author, index) => new { AuthorId = author.Id, Ordinal = index + 1 })
                .ToHashSet();

            // Get the real data of the authors of this problem
            var existingAuthors = await dbContext.ProblemAuthors
                .Where(authorship => authorship.ProblemId == existingProblem.Id)
                .OrderBy(authorship => authorship.Ordinal)
                .Select(authorship => new { authorship.AuthorId, authorship.Ordinal })
                .ToHashSetAsync();

            // Any author change?
            var authorsChanged = !desiredAuthors.SetEquals(existingAuthors);

            // If so
            if (authorsChanged)
            {
                // A simple algorithm, remove all of them
                await dbContext.ProblemAuthors
                    .Where(problemAuthor => problemAuthor.ProblemId == existingProblem.Id)
                    .ExecuteDeleteAsync();

                // And re-add
                dbContext.ProblemAuthors.AddRange(
                    desiredAuthors.Select(author => new ProblemAuthor
                    {
                        ProblemId = existingProblem.Id,
                        AuthorId = author.AuthorId,
                        Ordinal = author.Ordinal,
                    }));
            }
            #endregion

            #region Handle Images

            // Get the data of the images
            var desiredImages = images
                .Select(image => new { image.ContentId, image.Width, image.Height, image.Scale })
                .ToHashSet();

            var existingImages = await dbContext.ProblemImages
                .Where(image => image.ProblemId == existingProblem.Id)
                .Select(image => new { image.ContentId, image.Width, image.Height, image.Scale })
                .ToHashSetAsync();

            // Any changes?
            var imagesChanged = !desiredImages.SetEquals(existingImages);

            // If so...
            if (imagesChanged)
            {
                // Remove all of them
                await dbContext.ProblemImages
                    .Where(image => image.ProblemId == existingProblem.Id)
                    .ExecuteDeleteAsync();

                // And re-add
                dbContext.ProblemImages.AddRange(
                    desiredImages.Select(image => new ProblemImage
                    {
                        ProblemId = existingProblem.Id,
                        ContentId = image.ContentId,
                        Width = image.Width,
                        Height = image.Height,
                        Scale = image.Scale,
                    }));
            }

            #endregion

            // Find out if we updated a problem
            var hasUpdated = problemChanged || authorsChanged || imagesChanged;

            // We're done
            return (inserted: 0, updated: hasUpdated ? 1 : 0, skipped: hasUpdated ? 0 : 1);
        }
    }

    #endregion

    #region Competition and Round Resolution

    /// <summary>
    /// Maps the dataset's competition structure to the normalized database schema.
    /// </summary>
    /// <param name="competitionId">The parsed competition identifier from the dataset.</param>
    /// <returns>Competition and round data for database.</returns>
    private static CompetitionRoundData GetRoundData(CompetitionRoundId competitionId)
    {
        // Deconstruct the competition identifier into its components.
        var (categoryName, competitionName, subcompetitionName) = competitionId;

        // Map the dataset competition identifier to the canonical competition slug.
        // Some identifiers like "I", "II", "III", "S" all refer to different rounds of CSMO.
        var competitionSlug = competitionId.Competition switch
        {
            // These essentially mean one of the CSMO rounds.
            "I" or "II" or "III" or "S" => "CSMO",

            // Other competition identifiers are used as-is for the slug.
            _ => competitionId.Competition,
        };

        // Map competition slugs to their display order (names are handled separately).
        // Lower numbers appear first in the UI.
        var competitionDisplayOrder = competitionSlug switch
        {
            // Just a 'what-feels-right' ordering for the known competitions.
            "CSMO" => 1,
            "TST" => 2,
            "MEMO" => 3,
            "IMO" => 4,
            "CAPS" => 5,
            "EGMO" => 6,
            "TSTC" => 7,
            "CPSJ" => 8,

            // This should never happen with valid dataset.
            _ => throw new NotImplementedException($"Unknown competition slug '{competitionSlug}'"),
        };

        // Different rounds have different names based on the category.
        static string GetRoundName(string? categoryName, string competitionName) => categoryName switch
        {
            // Null should not happen with valid dataset.
            null => throw new NotImplementedException($"Cannot determine round name (krajské/okresné/celštátne...) when provided null category"),

            // Second and third rounds for high school categories (A, B, C).
            "A" or "B" or "C" => competitionName switch
            {
                "II" => "Krajské kolo",
                "III" => "Celoštátne kolo",

                // This should never happen with valid dataset.
                _ => throw new NotImplementedException($"Unknown competition '{competitionName}' for category '{categoryName}'"),
            },

            // Special case, Z4 usd to have a school round but in the data it is as II
            "Z4" when competitionName == "II" => "Školské kolo",

            // Second and third rounds for elementary school categories (Z5-Z9).
            _ when categoryName.StartsWith('Z') => competitionName switch
            {
                "II" => "Okresné kolo",
                "III" => "Krajské kolo",

                // This should never happen with valid dataset.
                _ => throw new NotImplementedException($"Unknown competition '{competitionName}' for category '{categoryName}'"),
            },

            // This should never happen with valid dataset.
            _ => throw new NotImplementedException($"Unknown category '{categoryName}'"),
        };

        // Parse the round data from the TST subcompetition identifier.
        // TST (Team Selection Test) competitions are held over multiple days (D1, D2, etc.).
        static RoundData ParseTstRoundData(string subcompetitionIdentifier)
        {
            // Expecting format like D1, D2, D3, etc.
            var dayMatch = Regex.Match(subcompetitionIdentifier, @"^D(\d+)$");

            // Make sure it parses correctly.
            if (!dayMatch.Success || !int.TryParse(dayMatch.Groups[1].Value, out var dayNumber))
                throw new InvalidCastException($"Unknown TST subcompetition '{subcompetitionIdentifier}'");

            // The day number is used for both the display name and the sort order to ensure uniqueness.
            return new RoundData(subcompetitionIdentifier, dayNumber, $"{dayNumber}. deň");
        }

        // Parse the round information based on the competition type and structure.
        var roundData = competitionSlug switch
        {
            // The Czech-Slovak Mathematical Olympiad has multiple rounds.
            "CSMO" => competitionName switch
            {
                // Home round (available for all categories)
                "I" => new RoundData(competitionName, 1, "Domáce kolo"),

                // School round (only for high school categories)
                "S" => new RoundData(competitionName, 2, "Školské kolo"),

                // The name of the 2nd/3rd round depend on the category,
                // e.g. II for A/B/C is "Krajské kolo", for Z5-Z9 is "Okresné kolo".
                "II" => new RoundData(competitionName, 3, GetRoundName(categoryName, competitionName)),
                "III" => new RoundData(competitionName, 4, GetRoundName(categoryName, competitionName)),

                // This should never happen with valid dataset.
                _ => throw new NotImplementedException($"Unknown CSMO competition '{competitionId.Competition}'"),
            },

            // Competitions with team/individual subcompetitions.
            "CPSJ" or "MEMO" => subcompetitionName switch
            {
                // Individual competition has no subcompetition identifier.
                null => new RoundData("I", 1, "Individual", "Individuálna časť"),

                // Team competition is marked with "T" subcompetition.
                "T" => new RoundData("T", 2, "Team", "Tímová časť"),

                // This should never happen with valid dataset.
                _ => throw new NotImplementedException($"Unknown {competitionSlug} subcompetition '{subcompetitionName}'"),
            },

            // The team selection test has multiple days...
            "TST" when subcompetitionName is not null => ParseTstRoundData(subcompetitionName),

            // Competitions without rounds (e.g., IMO, EGMO).
            _ => null,
        };

        // Return the resolved competition and round data.
        return new CompetitionRoundData(competitionSlug, competitionDisplayOrder, roundData, categoryName);
    }

    /// <summary>
    /// Gets both the short and full human-readable competition names from the competition slug.
    /// Maps internal competition slugs to their short names suitabl for displaying and full names
    /// suitable for tooltips.
    /// </summary>
    /// <param name="competitionSlug">The competition slug already used the DB (e.g., "CSMO", "IMO").</param>
    /// <returns>
    /// A tuple containing:
    ///   - The short competition name (e.g., "IMO")
    ///   - The full competition name in the original language (e.g. "International Mathematical Olympiad")
    /// </returns>
    private static (string DisplayName, string FullName) GetCompetitionNames(string competitionSlug) => competitionSlug switch
    {
        "csmo" => ("CSMO", "Česko-slovenská Matematická olympiáda"),
        "tst" => ("Výberko IMO/MEMO", "Výberové sústredenie pred IMO a MEMO"),
        "memo" => ("MEMO", "Middle European Mathematical Olympiad"),
        "imo" => ("IMO", "International Mathematical Olympiad"),
        "caps" => ("CAPS", "Czech-Austrian-Polish-Slovak Match"),
        "egmo" => ("EGMO", "European Girl's Mathematical Olympiad"),
        "tstc" => ("Výberko CPSJ", "Výberové sústredenie pred CPSJ"),
        "cpsj" => ("CPSJ", "Czech-Polish-Slovak Junior Match"),
        _ => throw new NotImplementedException($"Unknown competition slug '{competitionSlug}'"),
    };

    /// <summary>
    /// Determines the sort order for a category based on its name.
    /// Z{n} categories are ordered by n, then A, B, C follow.
    /// </summary>
    /// <param name="categoryName">The category name (e.g., "Z5", "A", "B", "C").</param>
    /// <returns>The sort order for the category.</returns>
    private static int GetCategorySortOrder(string categoryName) => categoryName.ToUpperInvariant() switch
    {
        // High-school first
        "A" => 1,
        "B" => 2,
        "C" => 3,

        // Then Z de-chronologically
        _ when categoryName.StartsWith('Z') && int.TryParse(categoryName.AsSpan(1), out var grade)
            // Difficult math: Z9 would get 4, Z8 then 5 etc
            => 13 - grade,

        // Weird
        _ => throw new NotImplementedException($"Unknown category name '{categoryName}'"),
    };

    #endregion
}
