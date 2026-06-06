using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services;
using MathComps.Infrastructure.Storage;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Integration tests for <see cref="DraftApplyService"/> against a real Postgres database, starting from an empty
/// schema so every run exercises the create path. These pin the behaviours a pure test can't reach: the taxonomy
/// chain is created with structural fields (sort order, edition number, composite slug) sourced from the registry,
/// a re-import is idempotent (overwrite in place, no duplicate rows), a translation attaches without disturbing the
/// original, and images are uploaded under the slug-based key with their refs rewritten into the stored markdown.
/// The R2 uploader is faked — no network — so the test asserts the keys and rewritten refs instead.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftApplyServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftApplyService>(fixture)
{
    /// <summary>
    /// The slug the csmo/a/iii · 2024 problem 1 upserts on — keyed by the season's edition (2024 − 1950 = 74).
    /// </summary>
    private const string ProblemSlug = "74-csmo-a-iii-1";

    /// <summary>
    /// Records every upload so the image assertions can read the keys back without touching the network.
    /// </summary>
    private readonly RecordingFileUploader _uploader = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The apply service needs an IFileUploader; supply the recording fake
        services.AddSingleton<IFileUploader>(_uploader);

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // Start empty — apply creates the whole taxonomy chain from the draft + registry.
        Task.CompletedTask;

    /// <summary>
    /// A net-new draft creates the whole taxonomy chain and the problem, with structural fields sourced from the
    /// registry, the season's edition derived as year − 1950, and the new problem hidden pending review.
    /// </summary>
    [Fact]
    public Task A_net_new_draft_creates_the_whole_chain() => RunApplyAsync(async service =>
    {
        // Import one Slovak-original problem with a statement and a solution.
        var result = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement", "solution"))], TempFolder());

        // Every taxonomy entity is newly created.
        Assert.All(result.Entities, entity => Assert.Equal(ResolutionAction.Create, entity.Action));
        Assert.Equal(1, result.ProblemsInserted);

        // Every created row carries the fields the registry and draft dictate.
        await QueryAsync(async (context, metadata) =>
        {
            // The competition carries its registry sort order.
            var competition = await context.Competitions.SingleAsync(entity => entity.Slug == "csmo");
            Assert.Equal(metadata.Shared.CompetitionSortOrder("csmo"), competition.SortOrder);

            // The category carries its registry sort order.
            var category = await context.Categories.SingleAsync(entity => entity.Slug == "a");
            Assert.Equal(metadata.Shared.CategorySortOrder("a"), category.SortOrder);

            // The round carries its registry sort order and composite slug, and isn't the default.
            var round = await context.Rounds.SingleAsync(entity => entity.CompositeSlug == "csmo-a-iii");
            Assert.Equal(metadata.Shared.Competition("csmo").RoundSortOrder("iii"), round.SortOrder);
            Assert.False(round.IsDefault);

            // The season's edition is the shared ročník derived from its start year.
            var season = await context.Seasons.SingleAsync(entity => entity.StartYear == 2024);
            Assert.Equal(2024 - 1950, season.EditionNumber);

            // The round-instance carries the draft's date.
            var roundInstance = await context.RoundInstances.SingleAsync();
            Assert.Equal(RoundDate, roundInstance.Date);

            // The problem is hidden pending review, numbered and slugged.
            var problem = await context.Problems.SingleAsync();
            Assert.Equal(ProblemSlug, problem.Slug);
            Assert.Equal(1, problem.Number);
            Assert.False(problem.IsPublished);

            // Two text rows landed — statement and solution.
            var texts = await context.ProblemTexts.Where(text => text.ProblemId == problem.Id).ToListAsync();
            Assert.Equal(2, texts.Count);

            // Both are Slovak originals.
            Assert.All(texts, text => Assert.True(text.IsOriginal));
            Assert.All(texts, text => Assert.Equal(Language.SK, text.Language));

            // Each half carries its own markdown.
            Assert.Equal("statement", StatementOf(texts).MarkdownText);
            Assert.Equal("solution", SolutionOf(texts).MarkdownText);

            // The author row is created once, with the registry name.
            var author = await context.Authors.SingleAsync();
            Assert.Equal("Jaromír Šimša", author.Name);

            // It's linked to the problem, ordered first.
            var problemAuthor = await context.ProblemAuthors.SingleAsync();
            Assert.Equal(author.Id, problemAuthor.AuthorId);
            Assert.Equal(1, problemAuthor.Ordinal);
        });
    });

    /// <summary>
    /// Re-importing the same problem overwrites its text in place: the markdown updates, but no duplicate problem,
    /// text or author rows appear, and the second run reports every taxonomy entity as reused.
    /// </summary>
    [Fact]
    public Task Re_importing_overwrites_in_place_without_duplicates() => RunApplyAsync(async service =>
    {
        // First import, then a second with changed statement text.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "first"))], TempFolder());
        var second = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "second"))], TempFolder());

        // The second run reuses the whole taxonomy and updates rather than inserts the problem.
        Assert.All(second.Entities, entity => Assert.Equal(ResolutionAction.Reuse, entity.Action));
        Assert.Equal(0, second.ProblemsInserted);
        Assert.Equal(1, second.ProblemsUpdated);

        await QueryAsync(async (context, _) =>
        {
            // Exactly one of everything — the re-import didn't duplicate rows.
            Assert.Equal(1, await context.Problems.CountAsync());
            Assert.Equal(1, await context.ProblemAuthors.CountAsync());

            // The statement now carries the second import's text.
            var statement = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Statement);
            Assert.Equal("second", statement.MarkdownText);
        });
    });

    /// <summary>
    /// A later draft that adds a translation onto an existing problem inserts the translation row and leaves the
    /// original's text and originality flag untouched.
    /// </summary>
    [Fact]
    public Task A_translation_attaches_without_touching_the_original() => RunApplyAsync(async service =>
    {
        // Import the Slovak original, then re-import it alongside a fresh Czech translation.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "original"))], TempFolder());
        await service.ApplyAsync(
            CsmoTarget(), RoundDate,
            [Problem(1, Original(Language.SK, "original"), Translation(Language.CS, "preklad"))], TempFolder());

        await QueryAsync(async (context, _) =>
        {
            // Two statement rows now — the original plus the new translation.
            var statements = await context.ProblemTexts
                .Where(text => text.DocumentType == DocumentType.Statement)
                .ToListAsync();
            Assert.Equal(2, statements.Count);

            // The Slovak original is untouched and still flagged original.
            var original = statements.Single(text => text.Language == Language.SK);
            Assert.True(original.IsOriginal);
            Assert.Equal("original", original.MarkdownText);

            // The Czech translation is present and not flagged original.
            var translation = statements.Single(text => text.Language == Language.CS);
            Assert.False(translation.IsOriginal);
            Assert.Equal("preklad", translation.MarkdownText);
        });
    });

    /// <summary>
    /// A problem's image is uploaded under the slug-based key and its relative ref is rewritten into the stored
    /// markdown, dimensions carried in the query string.
    /// </summary>
    [Fact]
    public Task An_image_is_uploaded_and_its_ref_rewritten() => RunApplyAsync(async service =>
    {
        // A draft folder holding one SVG referenced by the statement.
        var folder = TempFolder();
        Directory.CreateDirectory(Path.Combine(folder, "images"));
        await File.WriteAllTextAsync(
            Path.Combine(folder, "images", "incircle.svg"), "<svg width=\"100px\" height=\"80px\"></svg>");

        // Import a problem whose statement references that image.
        var statement = "see ![fig](images/incircle.svg)";
        var problem = new DraftProblemContent(
            1, ["Author"], null, [Original(Language.SK, statement)], ["incircle.svg"]);
        var result = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // One image was uploaded, under the slug-based problems/ key.
        Assert.Equal(1, result.ImagesUploaded);
        var (_, key) = Assert.Single(_uploader.Uploads);
        Assert.Equal($"problems/{ProblemSlug}-incircle", key);

        // The stored markdown points at the resolved media ref, dimensions and all — no relative ref left.
        await QueryAsync(async (context, _) =>
        {
            var stored = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Statement);
            Assert.Equal(
                $"see ![fig](media:{ProblemSlug}-incircle?width=100px&height=80px)", stored.MarkdownText);
        });
    });

    /// <summary>
    /// Re-importing with the authors reordered swaps their ordinals without tripping the (problem, ordinal) unique
    /// index — the reconcile drops the old rows before re-adding — and leaves the author set the same size.
    /// </summary>
    [Fact]
    public Task Re_importing_with_reordered_authors_swaps_ordinals() => RunApplyAsync(async service =>
    {
        // Import with two authors, then re-import with their order flipped.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Alice", "Bob"], Original(Language.SK, "s"))], TempFolder());
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Bob", "Alice"], Original(Language.SK, "s"))], TempFolder());

        await QueryAsync(async (context, _) =>
        {
            // Still exactly two distinct authors — no duplicate rows from the re-import.
            Assert.Equal(2, await context.Authors.CountAsync());

            // They now sit in the flipped order.
            var ordered = await context.ProblemAuthors
                .OrderBy(problemAuthor => problemAuthor.Ordinal)
                .Join(context.Authors, problemAuthor => problemAuthor.AuthorId, author => author.Id,
                    (_, author) => author.Name)
                .ToListAsync();
            Assert.Equal(["Bob", "Alice"], ordered);
        });
    });

    /// <summary>
    /// An author shared by two problems in one run is created once — the run-scoped cache reuses the row rather
    /// than inserting a duplicate that the unique author slug would reject.
    /// </summary>
    [Fact]
    public Task An_author_shared_across_problems_is_created_once() => RunApplyAsync(async service =>
    {
        // Two problems in the same round, both crediting the same author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
        [
            ProblemBy(1, ["Shared Author"], Original(Language.SK, "one")),
            ProblemBy(2, ["Shared Author"], Original(Language.SK, "two"))
        ], TempFolder());

        // One author row, linked from both problems.
        await QueryAsync(async (context, _) =>
        {
            Assert.Equal(1, await context.Authors.CountAsync());
            Assert.Equal(2, await context.ProblemAuthors.CountAsync());
        });
    });

    /// <summary>
    /// A draft whose original is in a different language than the stored original is refused with a clear error
    /// rather than an opaque unique-index violation — the guard a clean validate makes unreachable, proven to fire.
    /// </summary>
    [Fact]
    public Task A_second_original_in_another_language_is_rejected() => RunApplyAsync(async service =>
    {
        // Establish a Slovak original, then attempt a Czech original onto the same problem slug.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "sk"))], TempFolder());

        // The second original is rejected.
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.CS, "cs"))], TempFolder()));
    });

    /// <summary>
    /// A later draft can add a solution to a problem that was imported statement-only — the per-half upsert adds the
    /// solution row without disturbing the statement.
    /// </summary>
    [Fact]
    public Task A_solution_can_be_added_to_a_statement_only_problem() => RunApplyAsync(async service =>
    {
        // Import the statement alone, then re-import the same statement now carrying a solution.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], TempFolder());
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement", "solution"))], TempFolder());

        // The solution is now present as the Slovak original.
        await QueryAsync(async (context, _) =>
        {
            var solution = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Solution);
            Assert.True(solution.IsOriginal);
            Assert.Equal(Language.SK, solution.Language);
            Assert.Equal("solution", solution.MarkdownText);
        });
    });

    /// <summary>
    /// The round-instance date every draft in these tests imports under.
    /// </summary>
    private static DateOnly RoundDate => new(2024, 3, 15);

    /// <summary>
    /// Builds the draft target for the csmo/a/iii · 2024 round.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget CsmoTarget() => new("csmo", "a", "iii", 2024);

    /// <summary>
    /// Builds a draft problem with a single author and no images.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="texts">The problem's text variants.</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent Problem(int order, params DraftTextContent[] texts) =>
        ProblemBy(order, ["Jaromír Šimša"], texts);

    /// <summary>
    /// Builds a draft problem with the given authors and no images.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="authors">The author names, in order.</param>
    /// <param name="texts">The problem's text variants.</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent ProblemBy(
        int order, ImmutableArray<string> authors, params DraftTextContent[] texts) =>
        new(order, authors, SolutionLink: null, [.. texts], Images: []);

    /// <summary>
    /// Builds an original text variant.
    /// </summary>
    /// <param name="language">The original's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <param name="solution">The solution markdown, or null when absent.</param>
    /// <returns>The original text content.</returns>
    private static DraftTextContent Original(Language language, string statement, string? solution = null) =>
        new(language, Original: true, statement, solution);

    /// <summary>
    /// Builds a translation text variant.
    /// </summary>
    /// <param name="language">The translation's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <param name="solution">The solution markdown, or null when absent.</param>
    /// <returns>The translation text content.</returns>
    private static DraftTextContent Translation(Language language, string statement, string? solution = null) =>
        new(language, Original: false, statement, solution);

    /// <summary>
    /// The statement among a problem's texts.
    /// </summary>
    /// <param name="texts">The problem's texts.</param>
    /// <returns>The statement text.</returns>
    private static ProblemText StatementOf(IEnumerable<ProblemText> texts) =>
        texts.Single(text => text.DocumentType == DocumentType.Statement);

    /// <summary>
    /// The solution among a problem's texts.
    /// </summary>
    /// <param name="texts">The problem's texts.</param>
    /// <returns>The solution text.</returns>
    private static ProblemText SolutionOf(IEnumerable<ProblemText> texts) =>
        texts.Single(text => text.DocumentType == DocumentType.Solution);

    /// <summary>
    /// A throwaway folder path for drafts that reference no on-disk images.
    /// </summary>
    /// <returns>A temp folder path.</returns>
    private static string TempFolder() => Path.GetTempPath();

    /// <summary>
    /// Runs a test body with the apply service resolved from a fresh scope.
    /// </summary>
    /// <param name="testAction">The test body.</param>
    /// <returns>A task representing the test.</returns>
    private Task RunApplyAsync(Func<IDraftApplyService, Task> testAction) => RunTestAsync(testAction);

    /// <summary>
    /// Opens a fresh read scope against the same database and runs a query, handing the body both a context and the
    /// registry so assertions can compare against registry-sourced values.
    /// </summary>
    /// <param name="query">The query body.</param>
    /// <returns>A task representing the query.</returns>
    private async Task QueryAsync(Func<MathCompsDbContext, IMetadataLocalizationService, Task> query)
    {
        // A new provider over the same connection string sees the committed rows.
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        var metadata = scope.ServiceProvider.GetRequiredService<IMetadataLocalizationService>();
        await query(context, metadata);
    }

    /// <summary>
    /// A test double for <see cref="IFileUploader"/> that records uploads instead of hitting remote storage.
    /// </summary>
    private sealed class RecordingFileUploader : IFileUploader
    {
        /// <summary>
        /// Every upload, in call order.
        /// </summary>
        public ImmutableList<(string LocalPath, string Key)> Uploads { get; private set; } = [];

        /// <inheritdoc/>
        public Task UploadAsync(string localFilePath, string key)
        {
            // Record the call; nothing leaves the process.
            Uploads = Uploads.Add((localFilePath, key));
            return Task.CompletedTask;
        }
    }
}
