using MathComps.Infrastructure.Tests.TestInfrastructure;
using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static Microsoft.Extensions.Options.Options;
using MathComps.Domain.Tagging;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Integration tests for <see cref="DraftApplyService"/> against a real Postgres database, starting from an empty
/// schema so every run exercises the create path. These pin the behaviours a pure test can't reach: the taxonomy
/// chain is created with structural fields (path, sort order, sort path) sourced from the registry, a re-import is
/// idempotent (overwrite in place, no duplicate rows), a translation attaches without disturbing the original, and
/// images are uploaded under the slug-based key with their refs rewritten into the stored markdown.
/// The R2 uploader is faked — no network — so the test asserts the keys and rewritten refs instead.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftApplyServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftApplyService>(fixture)
{
    /// <summary>
    /// The slug the csmo-a-iii · 2024 problem 1 upserts on — keyed by the season's edition (2024 − 1950 = 74).
    /// </summary>
    private const string ProblemSlug = "74-csmo-a-iii-1";

    /// <summary>
    /// Records every upload so the image assertions can read the keys back without touching the network.
    /// </summary>
    private readonly RecordingFileUploader _uploader = new();

    /// <summary>
    /// A throwaway upload-ledger path, unique per test instance so the tracker one test fills can't leak into
    /// another (xUnit builds a fresh instance per <c>[Fact]</c>).
    /// </summary>
    private readonly string _ledgerPath =
        Path.Combine(Path.GetTempPath(), $"bulkimport-ledger-{Guid.NewGuid():N}.json");

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The recording fake stands in for R2. The tracker wraps it (real change-detection against a throwaway
        // ledger), and the apply service depends on the tracker — registered here because the bulk-import host
        // owns it, not shared infrastructure.
        services.AddSingleton<IFileUploader>(_uploader);
        services.AddSingleton<ITrackedFileUploader>(_ => new TrackedFileUploader(
            _uploader, Create(new UploadLedgerOptions { LedgerPath = _ledgerPath })));

        // The apply service also reads the metadata registry for taxonomy structure
        services.AddLocalization();

        // The read-only preview, so a test can check the dry run against what applying then does.
        services.AddBulkImport();

        // The tested service
        services.AddScoped<IDraftApplyService, DraftApplyService>();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // Start empty — apply creates the whole taxonomy chain from the draft + registry.
        Task.CompletedTask;

    /// <summary>
    /// A net-new draft creates the whole taxonomy chain and the problem, with structural fields sourced from the
    /// registry and the season's edition derived as year − 1950.
    /// </summary>
    [Fact]
    public Task A_net_new_draft_creates_the_whole_chain() => RunTestAsync(async service =>
    {
        // Import one Slovak-original problem with a statement and a solution.
        var result = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement", "solution"))], Path.GetTempPath());

        // Every taxonomy entity is newly created.
        Assert.All(result.Entities, entity => Assert.Equal(ResolutionAction.Create, entity.Action));
        Assert.Equal(1, result.ProblemsInserted);

        // Every created row carries the fields the registry and draft dictate.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // Every node on the path carries its registry sort order.
            foreach (var path in new[] { "csmo", "csmo-a", "csmo-a-iii" })
            {
                var node = await context.Competitions.SingleAsync(entity => entity.Path == path);
                Assert.Equal(metadata.Shared.SortOrder(path), node.SortOrder);
            }

            // The season's edition is the shared ročník derived from its start year.
            var season = await context.Seasons.SingleAsync(entity => entity.StartYear == 2024);
            Assert.Equal(2024 - 1950, season.EditionNumber);

            // The round carries the draft's date.
            var round = await context.Rounds.SingleAsync();
            Assert.Equal(RoundDate, round.Date);

            // The problem is numbered and slugged.
            var problem = await context.Problems.SingleAsync();
            Assert.Equal(ProblemSlug, problem.Slug);
            Assert.Equal(1, problem.Number);

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
    public Task Re_importing_overwrites_in_place_without_duplicates() => RunTestAsync(async service =>
    {
        // Import the problem.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "first"))], Path.GetTempPath());

        // Re-import it with changed statement text.
        var second = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "second"))], Path.GetTempPath());

        // The second run reuses the whole taxonomy and updates rather than inserts the problem.
        Assert.All(second.Entities, entity => Assert.Equal(ResolutionAction.Reuse, entity.Action));
        Assert.Equal(0, second.ProblemsInserted);
        Assert.Equal(1, second.ProblemsUpdated);

        // No rows were duplicated, and the statement now holds the second import's text.
        await QueryAsync(async context =>
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
    /// Re-importing byte-identical content changes nothing: the problem counts as unchanged rather than updated,
    /// every text reports unchanged, and the stored row's modified timestamp isn't bumped.
    /// </summary>
    [Fact]
    public Task Re_importing_identical_content_changes_nothing() => RunTestAsync(async service =>
    {
        // Import a problem.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // Read back its statement's modified timestamp.
        var firstModified = await QueryValueAsync(context => context.ProblemTexts
            .Where(text => text.DocumentType == DocumentType.Statement)
            .Select(text => text.DateModified)
            .SingleAsync());

        // Re-import the exact same content.
        var second = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // Nothing moved — the problem counts unchanged, not updated, and every text reports unchanged.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        Assert.All(second.Texts, text => Assert.Equal(AppliedTextAction.Unchanged, text.Action));

        // The stored row was left alone — its DateModified didn't advance.
        var secondModified = await QueryValueAsync(context => context.ProblemTexts
            .Where(text => text.DocumentType == DocumentType.Statement)
            .Select(text => text.DateModified)
            .SingleAsync());
        Assert.Equal(firstModified, secondModified);
    });

    /// <summary>
    /// A re-import that changes one language's body overwrites only that text and leaves the other untouched — the
    /// problem still counts as updated because something moved.
    /// </summary>
    [Fact]
    public Task Changing_one_language_overwrites_only_that_text() => RunTestAsync(async service =>
    {
        // Import a Slovak original plus an English translation.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [Problem(1, Original(Language.SK, "sk"), Translation(Language.EN, "en"))], Path.GetTempPath());

        // Re-import with only the Slovak body changed.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [Problem(1, Original(Language.SK, "sk-new"), Translation(Language.EN, "en"))], Path.GetTempPath());

        // Something moved, so the problem counts as updated.
        Assert.Equal(1, second.ProblemsUpdated);
        Assert.Equal(0, second.ProblemsUnchanged);

        // The Slovak statement was overwritten; the English one was recognised as unchanged.
        Assert.Equal(
            AppliedTextAction.Overwritten, second.Texts.Single(text => text.Language == Language.SK).Action);
        Assert.Equal(
            AppliedTextAction.Unchanged, second.Texts.Single(text => text.Language == Language.EN).Action);
    });

    /// <summary>
    /// Re-applying a draft whose <c>_meta</c> date was corrected updates the round's stored date in place: the
    /// round reports the update action and the row's date moves to the draft's new value.
    /// </summary>
    [Fact]
    public Task Re_applying_with_a_changed_date_updates_the_round() => RunTestAsync(async service =>
    {
        // Import the problem under the original round date.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // Re-import the identical draft under a corrected, later date.
        var correctedDate = new DateOnly(2024, 4, 1);
        var second = await service.ApplyAsync(
            CsmoTarget(), correctedDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // The round reports the date update distinctly from the quiet reuse path.
        var round = second.Entities.Single(entity => entity.EntityKind == "round");
        Assert.Equal(ResolutionAction.Update, round.Action);

        // The stored date actually moved to the corrected value.
        await QueryAsync(async context =>
            Assert.Equal(correctedDate, (await context.Rounds.SingleAsync()).Date));
    });

    /// <summary>
    /// Re-importing an image-bearing problem unchanged is recognised as a no-op: the rewritten body reproduces
    /// exactly, so the text reports unchanged and the problem doesn't count as updated.
    /// </summary>
    [Fact]
    public Task Re_importing_an_image_problem_with_no_changes_is_unchanged() => RunTestAsync(async service =>
    {
        // A dedicated draft folder holding one SVG referenced by the statement.
        var folder = Path.Combine(Path.GetTempPath(), $"bulkimport-apply-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(folder, "images"));
        await File.WriteAllTextAsync(
            Path.Combine(folder, "images", "fig.svg"), "<svg width=\"100px\" height=\"80px\"></svg>");

        // Import the image problem.
        var problem = new DraftProblemContent(
            1, true, ["Author"], null, null, [Original(Language.SK, "see ![f](images/fig.svg)")], ["fig.svg"]);
        await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // Re-import the very same draft.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // The reproduced media body matches the stored one, so nothing counts as updated.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        Assert.All(second.Texts, text => Assert.Equal(AppliedTextAction.Unchanged, text.Action));
    });

    /// <summary>
    /// A re-import that changes only the solution link counts the problem as updated, even though every text body is
    /// identical — the language-invariant field moved.
    /// </summary>
    [Fact]
    public Task Changing_only_the_solution_link_counts_as_updated() => RunTestAsync(async service =>
    {
        // Import without a solution link.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // Re-import the identical text, now carrying a solution link.
        var withLink = new DraftProblemContent(
            1, true, ["Jaromír Šimša"], "https://example.com/sol", null, [Original(Language.SK, "same")], Images: []);
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate, [withLink], Path.GetTempPath());

        // The link moved, so the problem counts as updated while its text reports unchanged.
        Assert.Equal(1, second.ProblemsUpdated);
        Assert.Equal(0, second.ProblemsUnchanged);
        Assert.All(second.Texts, text => Assert.Equal(AppliedTextAction.Unchanged, text.Action));
    });

    /// <summary>
    /// A re-import that omits the <c>solutionLink:</c> key (null) leaves the stored link untouched — protecting a link
    /// set by an earlier draft (or directly in the DB) from a link-less re-apply.
    /// </summary>
    [Fact]
    public Task Absent_solution_link_leaves_existing_link_untouched() => RunTestAsync(async service =>
    {
        // Import the problem carrying a solution link.
        var withLink = new DraftProblemContent(
            1, true, ["Jaromír Šimša"], "https://example.com/sol", null, [Original(Language.SK, "same")], Images: []);
        await service.ApplyAsync(CsmoTarget(), RoundDate, [withLink], Path.GetTempPath());

        // Re-import the identical text with no solutionLink key at all.
        var second = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "same"))], Path.GetTempPath());

        // Nothing moved — the absent key is not a clear — and the link survives.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        await QueryAsync(async context =>
            Assert.Equal("https://example.com/sol", (await context.Problems.SingleAsync()).SolutionLink));
    });

    /// <summary>
    /// A re-import that changes only the author set counts the problem as updated, even though the text body is
    /// identical — the authors moved.
    /// </summary>
    [Fact]
    public Task Changing_only_the_authors_counts_as_updated() => RunTestAsync(async service =>
    {
        // Import with two authors.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Alice", "Bob"], Original(Language.SK, "same"))], Path.GetTempPath());

        // Re-import the identical text with their order flipped.
        var second = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Bob", "Alice"], Original(Language.SK, "same"))], Path.GetTempPath());

        // The author set moved, so the problem counts as updated while its text reports unchanged.
        Assert.Equal(1, second.ProblemsUpdated);
        Assert.Equal(0, second.ProblemsUnchanged);
        Assert.Equal(
            AppliedTextAction.Unchanged,
            second.Texts.Single(text => text.DocumentType == DocumentType.Statement).Action);
    });

    /// <summary>
    /// A later draft that adds a translation onto an existing problem inserts the translation row and leaves the
    /// original's text and originality flag untouched.
    /// </summary>
    [Fact]
    public Task A_translation_attaches_without_touching_the_original() => RunTestAsync(async service =>
    {
        // Import the Slovak original.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "original"))], Path.GetTempPath());

        // Re-import it alongside a fresh Czech translation.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate,
            [Problem(1, Original(Language.SK, "original"), Translation(Language.CS, "preklad"))], Path.GetTempPath());

        // The original survived untouched and the Czech translation landed alongside it.
        await QueryAsync(async context =>
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
    public Task An_image_is_uploaded_and_its_ref_rewritten() => RunTestAsync(async service =>
    {
        // A dedicated draft folder holding one SVG referenced by the statement.
        var folder = Path.Combine(Path.GetTempPath(), $"bulkimport-apply-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(folder, "images"));
        await File.WriteAllTextAsync(
            Path.Combine(folder, "images", "incircle.svg"), "<svg width=\"100px\" height=\"80px\"></svg>");

        // Import a problem whose statement references that image.
        var statement = "see ![fig](images/incircle.svg)";
        var problem = new DraftProblemContent(
            1, true, ["Author"], null, null, [Original(Language.SK, statement)], ["incircle.svg"]);
        var result = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // One image was uploaded, under the slug-based problems/ key.
        Assert.Equal(1, result.ImagesUploaded);
        Assert.Equal(0, result.ImagesSkipped);
        var (_, key) = Assert.Single(_uploader.Uploads);
        Assert.Equal($"problems/{ProblemSlug}-incircle", key);

        // The stored markdown points at the resolved media ref, dimensions and all — no relative ref left.
        await QueryAsync(async context =>
        {
            var stored = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Statement);
            Assert.Equal(
                $"see ![fig](media:{ProblemSlug}-incircle?width=100&height=80)", stored.MarkdownText);
        });
    });

    /// <summary>
    /// A raster (PNG) image is uploaded under the slug-based key and its ref rewritten with the PNG's real pixel
    /// dimensions — the raster counterpart to the SVG path, proving the pipeline sizes, keys and rewrites raster
    /// figures too.
    /// </summary>
    [Fact]
    public Task A_raster_image_is_uploaded_and_its_ref_rewritten() => RunTestAsync(async service =>
    {
        // A dedicated draft folder holding one real 4×2 PNG referenced by the statement.
        var folder = Path.Combine(Path.GetTempPath(), $"bulkimport-apply-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(folder, "images"));
        File.Copy(
            Path.Combine(AppContext.BaseDirectory, "Fixtures", "Images", "fig.png"),
            Path.Combine(folder, "images", "incircle.png"));

        // Import a problem whose statement references that image.
        var statement = "see ![fig](images/incircle.png)";
        var problem = new DraftProblemContent(
            1, true, ["Author"], null, null, [Original(Language.SK, statement)], ["incircle.png"]);
        var result = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // One image uploaded, under the slug-based key.
        Assert.Equal(1, result.ImagesUploaded);
        Assert.Equal(0, result.ImagesSkipped);
        var (_, key) = Assert.Single(_uploader.Uploads);
        Assert.Equal($"problems/{ProblemSlug}-incircle", key);

        // The stored markdown points at the resolved media ref, carrying the PNG's real 4×2 dimensions.
        await QueryAsync(async context =>
        {
            var stored = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Statement);
            Assert.Equal(
                $"see ![fig](media:{ProblemSlug}-incircle?width=4&height=2)", stored.MarkdownText);
        });
    });

    /// <summary>
    /// Re-applying a draft whose image hasn't changed skips the re-upload: the apply reports it uploaded the first
    /// time and skipped the second, and the inner uploader is only ever called once.
    /// </summary>
    [Fact]
    public Task Re_applying_an_unchanged_image_skips_the_upload() => RunTestAsync(async service =>
    {
        // A dedicated draft folder holding one SVG referenced by the statement.
        var folder = Path.Combine(Path.GetTempPath(), $"bulkimport-apply-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(folder, "images"));
        await File.WriteAllTextAsync(
            Path.Combine(folder, "images", "fig.svg"), "<svg width=\"100px\" height=\"80px\"></svg>");

        // The image problem the draft holds.
        var problem = new DraftProblemContent(
            1, true, ["Author"], null, null, [Original(Language.SK, "see ![f](images/fig.svg)")], ["fig.svg"]);

        // Import it.
        var first = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // Re-import the very same draft.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate, [problem], folder);

        // The first apply uploads the image; the second recognises it as unchanged and skips it.
        Assert.Equal(1, first.ImagesUploaded);
        Assert.Equal(0, first.ImagesSkipped);
        Assert.Equal(0, second.ImagesUploaded);
        Assert.Equal(1, second.ImagesSkipped);

        // Only the first apply's single upload ever left the process.
        Assert.Single(_uploader.Uploads);
    });

    /// <summary>
    /// Re-importing with the authors reordered swaps their ordinals without tripping the (problem, ordinal) unique
    /// index — the reconcile drops the old rows before re-adding — and leaves the author set the same size.
    /// </summary>
    [Fact]
    public Task Re_importing_with_reordered_authors_swaps_ordinals() => RunTestAsync(async service =>
    {
        // Import with two authors.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Alice", "Bob"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with their order flipped.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [ProblemBy(1, ["Bob", "Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // No duplicate authors, and they now sit in the flipped order.
        await QueryAsync(async context =>
        {
            // Still exactly two distinct authors — no duplicate rows from the re-import.
            Assert.Equal(2, await context.Authors.CountAsync());

            // They now sit in the flipped order.
            Assert.Equal(["Bob", "Alice"], await AuthorNamesAsync(context));
        });
    });

    /// <summary>
    /// A re-import that omits the <c>authors:</c> key (null) leaves the stored authors untouched — protecting authors
    /// credited by an earlier draft from an author-less re-apply (e.g. one attaching only a solution).
    /// </summary>
    [Fact]
    public Task Absent_authors_leave_existing_authors_untouched() => RunTestAsync(async service =>
    {
        // Import the problem credited to one author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with no authors key at all.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, null, Original(Language.SK, "s"))], Path.GetTempPath());

        // Nothing moved — the absent key is not a clear — and the author survives.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        await QueryAsync(async context => Assert.Equal(["Alice"], await AuthorNamesAsync(context)));
    });

    /// <summary>
    /// A re-import with an explicit empty list clears the stored authors.
    /// </summary>
    [Fact]
    public Task An_empty_authors_list_clears_the_authors() => RunTestAsync(async service =>
    {
        // Import the problem credited to one author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with an empty authors list.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, [], Original(Language.SK, "s"))], Path.GetTempPath());

        // The clear counts as an update and removes the join row.
        Assert.Equal(1, second.ProblemsUpdated);
        await QueryAsync(async context => Assert.Equal(0, await context.ProblemAuthors.CountAsync()));
    });

    /// <summary>
    /// A re-import with a different author set replaces the stored authors wholesale (the draft is the source of
    /// truth), without tripping the (problem, ordinal) unique key — the reconcile drops the old rows before re-adding.
    /// </summary>
    [Fact]
    public Task A_changed_authors_list_replaces_the_set() => RunTestAsync(async service =>
    {
        // Import with one author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with a different one.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Bob"], Original(Language.SK, "s"))], Path.GetTempPath());

        // The set moved, leaving exactly the new author.
        Assert.Equal(1, second.ProblemsUpdated);
        await QueryAsync(async context => Assert.Equal(["Bob"], await AuthorNamesAsync(context)));
    });

    /// <summary>
    /// Re-importing the identical author set changes nothing — the problem counts as unchanged, not updated.
    /// </summary>
    [Fact]
    public Task Re_importing_the_same_authors_changes_nothing() => RunTestAsync(async service =>
    {
        // Import credited to one author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import the very same authors.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemBy(1, ["Alice"], Original(Language.SK, "s"))], Path.GetTempPath());

        // The author set matched, so the problem is unchanged and no rows were duplicated.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        await QueryAsync(async context => Assert.Equal(1, await context.ProblemAuthors.CountAsync()));
    });

    /// <summary>
    /// An author shared by two problems in one run is created once — the run-scoped cache reuses the row rather
    /// than inserting a duplicate that the unique author slug would reject.
    /// </summary>
    [Fact]
    public Task An_author_shared_across_problems_is_created_once() => RunTestAsync(async service =>
    {
        // Two problems in the same round, both crediting the same author.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
        [
            ProblemBy(1, ["Shared Author"], Original(Language.SK, "one")),
            ProblemBy(2, ["Shared Author"], Original(Language.SK, "two"))
        ], Path.GetTempPath());

        // One author row, linked from both problems.
        await QueryAsync(async context =>
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
    public Task A_second_original_in_another_language_is_rejected() => RunTestAsync(async service =>
    {
        // Establish a Slovak original.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "sk"))], Path.GetTempPath());

        // The second original is rejected.
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.CS, "cs"))], Path.GetTempPath()));
    });

    /// <summary>
    /// A later draft can add a solution to a problem that was imported statement-only — the per-half upsert adds the
    /// solution row without disturbing the statement.
    /// </summary>
    [Fact]
    public Task A_solution_can_be_added_to_a_statement_only_problem() => RunTestAsync(async service =>
    {
        // Import the statement alone.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Re-import the same statement now carrying a solution.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement", "solution"))], Path.GetTempPath());

        // The solution is now present as the Slovak original.
        await QueryAsync(async context =>
        {
            var solution = await context.ProblemTexts.SingleAsync(text => text.DocumentType == DocumentType.Solution);
            Assert.True(solution.IsOriginal);
            Assert.Equal(Language.SK, solution.Language);
            Assert.Equal("solution", solution.MarkdownText);
        });
    });

    /// <summary>
    /// A draft carrying a populated tags list assigns each tag at the human-assigned convention (fit 1.0, no
    /// confidence or justification) and creates the Tag rows with the category derived from the vocabulary.
    /// </summary>
    [Fact]
    public Task A_populated_tags_list_assigns_the_tags() => RunTestAsync(async service =>
    {
        // Import a problem tagged with one Area slug and one Technique slug.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra", "am-gm-inequality"], Original(Language.SK, "s", "sol"))],
            Path.GetTempPath());

        // Read the stored tags back from the database.
        await QueryAsync(async context =>
        {
            // Both tags were created with the right category and joined to the problem.
            Assert.Equal(TagType.Area, await TagTypeOfAsync(context, "algebra"));
            Assert.Equal(TagType.Technique, await TagTypeOfAsync(context, "am-gm-inequality"));

            // Each join row follows the human-assigned convention.
            var rows = await context.ProblemTags.ToListAsync();
            Assert.Equal(2, rows.Count);
            Assert.All(rows, row =>
            {
                Assert.Equal(1.0f, row.GoodnessOfFit);
                Assert.Null(row.Confidence);
                Assert.Null(row.Justification);
            });
        });
    });

    /// <summary>
    /// A re-import that omits the <c>tags:</c> key (null) leaves the stored tags untouched — protecting tags assigned
    /// by an earlier draft from a tag-less re-apply.
    /// </summary>
    [Fact]
    public Task Absent_tags_leave_existing_tags_untouched() => RunTestAsync(async service =>
    {
        // Import the problem tagged.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with no tags key at all.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, null, Original(Language.SK, "s"))], Path.GetTempPath());

        // Nothing moved — the absent key is not a clear — and the tag survives.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        await QueryAsync(async context => Assert.Equal(["algebra"], await TagSlugsAsync(context)));
    });

    /// <summary>
    /// A re-import with an explicit empty list clears the stored tags.
    /// </summary>
    [Fact]
    public Task An_empty_tags_list_clears_the_tags() => RunTestAsync(async service =>
    {
        // Import the problem tagged.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with an empty tags list.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, [], Original(Language.SK, "s"))], Path.GetTempPath());

        // The clear counts as an update and removes the join row.
        Assert.Equal(1, second.ProblemsUpdated);
        await QueryAsync(async context => Assert.Equal(0, await context.ProblemTags.CountAsync()));
    });

    /// <summary>
    /// A re-import with a different tag set replaces the stored tags wholesale (the draft is the source of truth),
    /// without tripping the (problem, tag) unique key — the reconcile drops the old rows before re-adding.
    /// </summary>
    [Fact]
    public Task A_changed_tags_list_replaces_the_set() => RunTestAsync(async service =>
    {
        // Import with one tag.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import with a different one.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["number-theory"], Original(Language.SK, "s"))], Path.GetTempPath());

        // The set moved, leaving exactly the new tag.
        Assert.Equal(1, second.ProblemsUpdated);
        await QueryAsync(async context => Assert.Equal(["number-theory"], await TagSlugsAsync(context)));
    });

    /// <summary>
    /// Re-importing the identical tag set changes nothing — the problem counts as unchanged, not updated.
    /// </summary>
    [Fact]
    public Task Re_importing_the_same_tags_changes_nothing() => RunTestAsync(async service =>
    {
        // Import tagged.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import the very same tags.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // The tag set matched, so the problem is unchanged and no rows were duplicated.
        Assert.Equal(0, second.ProblemsUpdated);
        Assert.Equal(1, second.ProblemsUnchanged);
        await QueryAsync(async context => Assert.Equal(1, await context.ProblemTags.CountAsync()));
    });

    /// <summary>
    /// Reducing the tag set to a subset of itself — dropping one member while keeping another — is recognised as a
    /// change and leaves exactly the retained tag. This is the partial-overlap reconcile transition the disjoint
    /// replace and the full clear don't exercise.
    /// </summary>
    [Fact]
    public Task Reducing_the_tag_set_keeps_only_the_retained_tag() => RunTestAsync(async service =>
    {
        // Import with two tags.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra", "number-theory"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Re-import dropping one but keeping the other.
        var second = await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // The set moved, leaving exactly the retained tag.
        Assert.Equal(1, second.ProblemsUpdated);
        await QueryAsync(async context => Assert.Equal(["algebra"], await TagSlugsAsync(context)));
    });

    /// <summary>
    /// A draft that lists the same slug twice (here with differing casing) collapses to a single tag row stored under
    /// the canonical slug, rather than tripping the (problem, tag) primary key on a duplicate insert.
    /// </summary>
    [Fact]
    public Task A_duplicate_or_case_variant_slug_collapses_to_one_canonical_row() => RunTestAsync(async service =>
    {
        // Import a problem whose tags list repeats one slug under two casings.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
            [ProblemWithTags(1, ["algebra", "Algebra"], Original(Language.SK, "s"))], Path.GetTempPath());

        // Exactly one row, stored under the canonical lowercase slug.
        await QueryAsync(async context =>
        {
            Assert.Equal(1, await context.ProblemTags.CountAsync());
            Assert.Equal(["algebra"], await TagSlugsAsync(context));
        });
    });

    /// <summary>
    /// A tag shared by two problems in one run is created once — the run-scoped tag cache reuses the row rather than
    /// inserting a duplicate the unique tag slug would reject (the tag analogue of the shared-author case).
    /// </summary>
    [Fact]
    public Task A_tag_shared_across_problems_is_created_once() => RunTestAsync(async service =>
    {
        // Two problems in one run, both carrying the same tag.
        await service.ApplyAsync(CsmoTarget(), RoundDate,
        [
            ProblemWithTags(1, ["algebra"], Original(Language.SK, "one")),
            ProblemWithTags(2, ["algebra"], Original(Language.SK, "two"))
        ], Path.GetTempPath());

        // One Tag row, linked from both problems.
        await QueryAsync(async context =>
        {
            Assert.Equal(1, await context.Tags.CountAsync());
            Assert.Equal(2, await context.ProblemTags.CountAsync());
        });
    });

    /// <summary>
    /// Registering a competition in the middle of the registry array shifts the later competitions' positions; apply
    /// re-sequences the existing rows out of the way first, so the new competition lands without colliding with a
    /// stored sort order.
    /// </summary>
    [Fact]
    public Task Inserting_a_competition_mid_array_resequences_the_later_competitions() => RunTestAsync(async service =>
    {
        // Seed the competitions as they stood before "tst" entered the registry — csmo/memo/imo as a contiguous block.
        await QueryAsync(async context =>
        {
            // The pre-insertion rows, at the orders the registry then dictated.
            CompetitionTreeSeed.Root(context, "csmo", 1);
            CompetitionTreeSeed.Root(context, "memo", 2);
            CompetitionTreeSeed.Root(context, "imo", 3);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a tst problem — tst sits at registry order 2, the slot memo currently holds.
        var result = await service.ApplyAsync(
            new DraftTarget("tst-d1", 2024), RoundDate,
            [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Every competition, the new one included, now carries its registry order.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // Check each competition in the final taxonomy.
            foreach (var slug in new[] { "csmo", "tst", "memo", "imo" })
            {
                // The stored row.
                var competition = await context.Competitions.SingleAsync(entity => entity.Slug == slug);

                // It sits at its registry position.
                Assert.Equal(metadata.Shared.SortOrder(slug), competition.SortOrder);
            }
        });

        // The renumbering is reported, memo and imo each shifted up by one.
        Assert.Contains(new SortOrderChange("memo", 2, 3), result.SortOrderChanges);
        Assert.Contains(new SortOrderChange("imo", 3, 4), result.SortOrderChanges);
    });

    /// <summary>
    /// A non-monotone drift — two competitions in swapped order — is reconciled by the park-then-renumber two-phase,
    /// which a naive in-place renumber couldn't do without transiently colliding on the unique sort-order index.
    /// </summary>
    [Fact]
    public Task A_swapped_pair_of_competitions_is_resequenced() => RunTestAsync(async service =>
    {
        // Seed csmo and memo with their orders swapped relative to the registry (registry puts them at 1 and 3).
        await QueryAsync(async context =>
        {
            // The swapped rows.
            CompetitionTreeSeed.Root(context, "csmo", 3);
            CompetitionTreeSeed.Root(context, "memo", 1);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo problem — apply reconciles the whole competition space before touching the draft's taxonomy.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Both rows now sit at their registry orders, the swap untangled.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // csmo dropped to its registry order.
            var csmo = await context.Competitions.SingleAsync(entity => entity.Slug == "csmo");
            Assert.Equal(metadata.Shared.SortOrder("csmo"), csmo.SortOrder);

            // memo rose to its registry order.
            var memo = await context.Competitions.SingleAsync(entity => entity.Slug == "memo");
            Assert.Equal(metadata.Shared.SortOrder("memo"), memo.SortOrder);
        });
    });

    /// <summary>
    /// Applying a draft into an empty database raises the whole chain of competitions its target names, each
    /// addressed by the path its slugs spell and positioned among its siblings.
    /// </summary>
    [Fact]
    public Task Applying_a_draft_raises_the_competition_chain() => RunTestAsync(async service =>
    {
        // Import a csmo-a-iii problem into a database carrying no taxonomy at all.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Every level the path names now stands as a competition.
        await QueryAsync(async context =>
        {
            // The whole tree, shallowest first.
            var tree = await context.Competitions.OrderBy(entity => entity.SortPath).ToListAsync();

            // One row per level, each extending the path above it.
            Assert.Equal(["csmo", "csmo-a", "csmo-a-iii"], tree.Select(entity => entity.Path));

            // The brand heads the tree, so nothing sits above it.
            Assert.Null(tree[0].ParentId);

            // Each level below hangs off the one before it.
            Assert.Equal(tree[0].Id, tree[1].ParentId);
            Assert.Equal(tree[1].Id, tree[2].ParentId);

            // The sort path reads down the chain: csmo first among the brands, a first among its categories,
            // iii fourth among its rounds. A root extends nothing, so it carries its own position alone.
            Assert.Equal(["0001", "0001.0001", "0001.0001.0004"], tree.Select(entity => entity.SortPath));

            // The round hangs off the deepest level, which is where its problems sit in the tree.
            var round = await context.Rounds
                .Include(entity => entity.Competition)
                .SingleAsync();
            Assert.Equal("csmo-a-iii", round.Competition.Path);
        });
    });

    /// <summary>
    /// A single-segment competition path stops the chain at the root, so a whole brand running as one sitting is
    /// what its problems hang under.
    /// </summary>
    [Fact]
    public Task A_root_path_stands_for_the_whole_competition() => RunTestAsync(async service =>
    {
        // Import an imo problem, imo being a competition the registry gives no rounds at all.
        await service.ApplyAsync(
            new DraftTarget("imo", 2024), RoundDate,
            [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // The brand is the only row, and the round hangs off it.
        await QueryAsync(async context =>
        {
            // The whole tree.
            var tree = await context.Competitions.ToListAsync();

            // Nothing sits below the brand, since the flat sitting is the brand itself.
            Assert.Equal(["imo"], tree.Select(entity => entity.Path));

            // The round resolves to that brand, with no node of its own in between.
            var round = await context.Rounds
                .Include(entity => entity.Competition)
                .SingleAsync();
            Assert.Equal("imo", round.Competition.Path);
        });
    });

    /// <summary>
    /// A competition holds its absolute registry position rather than being packed against its siblings, so
    /// one joining ahead of another slots in without disturbing it and the rounds a category never ran leave
    /// their slots empty.
    /// </summary>
    [Fact]
    public Task A_competition_holds_its_absolute_registry_position() => RunTestAsync(async service =>
    {
        // Import csmo-a-iii first, which leaves it the only round under its category.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Then import csmo-a-i, which the registry orders ahead of iii.
        await service.ApplyAsync(
            new DraftTarget("csmo-a-i", 2024), RoundDate,
            [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Both sit where csmo's round list puts them, the unused s and ii slots left open between them.
        await QueryAsync(async context =>
        {
            // The category's children, in the order they sort.
            var rounds = await context.Competitions
                .Where(entity => entity.Parent!.Path == "csmo-a")
                .OrderBy(entity => entity.SortOrder)
                .ToListAsync();

            // The newcomer took the front, and iii kept the position it already held.
            Assert.Equal(["csmo-a-i", "csmo-a-iii"], rounds.Select(entity => entity.Path));
            Assert.Equal([1, 4], rounds.Select(entity => entity.SortOrder));

            // The sort paths carry the same positions, and are what the tree is read in order by.
            Assert.Equal(["0001.0001.0001", "0001.0001.0004"], rounds.Select(entity => entity.SortPath));
        });
    });

    /// <summary>
    /// Re-sequencing reaches every generation the chain descends through, not just the roots: a round shifted up
    /// in the registry is renumbered on apply.
    /// </summary>
    [Fact]
    public Task Inserting_a_round_mid_array_resequences_the_sibling_rounds() => RunTestAsync(async service =>
    {
        // Seed csmo-a with two rounds as they stood before "s"/"ii" entered — i and iii as a contiguous block.
        await QueryAsync(async context =>
        {
            // Chain places each round at the next free slot, so they land contiguously at 1 and 2.
            CompetitionTreeSeed.Chain(context, "csmo-a-i");
            CompetitionTreeSeed.Chain(context, "csmo-a-iii");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo-a-iii problem — apply reconciles the generation before reusing the node.
        var result = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Round iii now carries its registry order, shifted up from the stored 2.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // The stored node.
            var roundIii = await context.Competitions.SingleAsync(entity => entity.Path == "csmo-a-iii");

            // It sits at its registry position among its siblings.
            Assert.Equal(metadata.Shared.SortOrder("csmo-a-iii"), roundIii.SortOrder);
        });

        // The renumbering is reported.
        Assert.Contains(new SortOrderChange("csmo-a-iii", 2, 4), result.SortOrderChanges);
    });

    /// <summary>
    /// Re-sequencing reaches the middle generation too: a category shifted up in the registry is renumbered on
    /// apply, and the sort paths below it are rewritten to match.
    /// </summary>
    [Fact]
    public Task Inserting_a_category_mid_array_resequences_the_later_categories() => RunTestAsync(async service =>
    {
        // Seed csmo's categories a and c as they stood before "b" entered — a contiguous a/c block.
        await QueryAsync(async context =>
        {
            // Chain places each category at the next free slot under csmo, so they land at 1 and 2.
            CompetitionTreeSeed.Chain(context, "csmo-a");
            CompetitionTreeSeed.Chain(context, "csmo-c");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo-a-iii problem — apply reconciles csmo's children before reusing category a.
        var result = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Category c now carries its registry order, shifted up from the stored 2.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // The stored node.
            var categoryC = await context.Competitions.SingleAsync(entity => entity.Path == "csmo-c");

            // It sits at its registry position.
            Assert.Equal(metadata.Shared.SortOrder("csmo-c"), categoryC.SortOrder);
        });

        // The renumbering is reported.
        Assert.Contains(new SortOrderChange("csmo-c", 2, 3), result.SortOrderChanges);
    });

    /// <summary>
    /// Applying onto a DB that already agrees with the registry renumbers nothing.
    /// </summary>
    [Fact]
    public Task A_registry_consistent_db_is_not_resequenced() => RunTestAsync(async service =>
    {
        // Seed a competition already at its registry order.
        await QueryAsync(async context =>
        {
            // The registry-consistent row.
            CompetitionTreeSeed.Root(context, "csmo", 1);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo problem onto the consistent DB.
        var result = await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Nothing drifted, so nothing was re-sequenced.
        Assert.Empty(result.SortOrderChanges);
    });

    /// <summary>
    /// A generation that both drifted out of order and gained siblings above it: the two stored rounds swap
    /// relative to each other while moving into slots the registry only grew later, so their targets sit above
    /// every order the generation currently holds. Parking has to clear the highest target, not just the highest
    /// stored order, or one mover lands on the slot another is still parked in.
    /// </summary>
    [Fact]
    public Task A_swapped_pair_moving_into_new_slots_is_resequenced() => RunTestAsync(async service =>
    {
        // Seed csmo-a with iii and ii inverted, as a two-round block from before "i" and "s" entered the registry.
        await QueryAsync(async context =>
        {
            // Chain places each round at the next free slot, so iii lands at 1 and ii at 2.
            CompetitionTreeSeed.Chain(context, "csmo-a-iii");
            CompetitionTreeSeed.Chain(context, "csmo-a-ii");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo-a-iii problem — apply reconciles the generation before reusing the node.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Both rounds now sit at their registry orders, the inversion untangled.
        await QueryAsync<IMetadataLocalizationService>(async (context, metadata) =>
        {
            // Each stored round in turn.
            foreach (var path in new[] { "csmo-a-ii", "csmo-a-iii" })
            {
                // The stored node.
                var node = await context.Competitions.SingleAsync(entity => entity.Path == path);

                // It sits at its registry position among its siblings.
                Assert.Equal(metadata.Shared.SortOrder(path), node.SortOrder);
            }
        });
    });

    /// <summary>
    /// A sort path reads down the whole chain, so renumbering a node has to restamp everything below it — not
    /// just the node that moved. The tree is read in order by those paths, so a descendant left holding its old
    /// one would sort against a position its ancestor no longer occupies.
    /// </summary>
    [Fact]
    public Task Resequencing_a_node_restamps_the_sort_paths_below_it() => RunTestAsync(async service =>
    {
        // Seed csmo's categories a and c as a contiguous block from before "b" entered, c carrying a round of its own.
        await QueryAsync(async context =>
        {
            // Chain places category a at 1 and its round iii at 1 below it.
            CompetitionTreeSeed.Chain(context, "csmo-a-iii");

            // Category c follows at 2, its round i landing at 1 below it.
            CompetitionTreeSeed.Chain(context, "csmo-c-i");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Import a csmo-a-iii problem — apply reconciles csmo's children, which shifts category c up.
        await service.ApplyAsync(
            CsmoTarget(), RoundDate, [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath());

        // Both moved nodes and their descendants carry paths built from the new positions.
        await QueryAsync(async context =>
        {
            // Category c moved from 2 to its registry order 3, and its round rode along.
            var categoryRound = await context.Competitions.SingleAsync(entity => entity.Path == "csmo-c-i");
            Assert.Equal("0001.0003.0001", categoryRound.SortPath);

            // Round iii moved from 1 to its registry order 4 under a category that stayed put.
            var nationalRound = await context.Competitions.SingleAsync(entity => entity.Path == "csmo-a-iii");
            Assert.Equal("0001.0001.0004", nationalRound.SortPath);
        });
    });

    /// <summary>
    /// A node the registry can't place has no position to give it, so apply refuses the draft outright rather
    /// than writing a row whose sort order is invented.
    /// </summary>
    [Fact]
    public Task A_draft_naming_an_unregistered_competition_is_refused() => RunTestAsync(async service =>
    {
        // Import a draft whose competition the registry doesn't carry.
        var refusal = await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApplyAsync(
            new DraftTarget("notacomp-i", 2024), RoundDate,
            [Problem(1, Original(Language.SK, "statement"))], Path.GetTempPath()));

        // The refusal names the path it couldn't place.
        Assert.Contains("notacomp", refusal.Message);

        // Nothing was written on the way to the throw.
        await QueryAsync(async context => Assert.Empty(await context.Competitions.ToListAsync()));
    });

    /// <summary>
    /// The dry run and the write walk the same generations, so what the preview reports as re-sequencing has to
    /// be exactly what applying then performs — the two walks living in different services is what would let
    /// them drift, leaving the preview quietly lying about what the import is about to renumber.
    /// </summary>
    [Fact]
    public Task The_preview_predicts_the_resequencing_apply_performs() => RunTestAsync(async service =>
    {
        // Seed drift at two different depths: memo sits a slot early among the roots, and iii a slot early
        // among its category's rounds.
        await QueryAsync(async context =>
        {
            // csmo takes the first root slot, iii the first round slot under category a.
            CompetitionTreeSeed.Chain(context, "csmo-a-iii");

            // memo follows csmo at the second root slot, where the registry now puts tst.
            CompetitionTreeSeed.Root(context, "memo", 2);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // The draft both the dry run and the write are given.
        var target = CsmoTarget();
        var problems = new[] { Problem(1, Original(Language.SK, "statement")) };

        // What the dry run says the import would renumber.
        var predicted = ImmutableArray<SortOrderChange>.Empty;
        await QueryAsync<IDraftResolutionService>(async (_, resolution) =>
            predicted = (await resolution.PreviewAsync(target, problems, Path.GetTempPath())).SortOrderChanges);

        // The dry run has something to predict, or the comparison below would pass on two empty sets.
        Assert.NotEmpty(predicted);

        // What applying actually renumbers.
        var result = await service.ApplyAsync(target, RoundDate, problems, Path.GetTempPath());

        // The two agree, path by path.
        Assert.Equal(
            predicted.OrderBy(change => change.Path),
            result.SortOrderChanges.OrderBy(change => change.Path));
    });

    /// <summary>
    /// Reads the author names credited on the single test problem, in ordinal order.
    /// </summary>
    /// <param name="context">The query context.</param>
    /// <returns>The author names, ordered by their ordinal.</returns>
    private static async Task<List<string>> AuthorNamesAsync(MathCompsDbContext context) =>
        await context.ProblemAuthors
            .OrderBy(problemAuthor => problemAuthor.Ordinal)
            .Join(context.Authors, problemAuthor => problemAuthor.AuthorId, author => author.Id,
                (_, author) => author.Name)
            .ToListAsync();

    /// <summary>
    /// Reads the slugs currently tagged on the single test problem, in alphabetical order.
    /// </summary>
    /// <param name="context">The query context.</param>
    /// <returns>The tagged slugs.</returns>
    private static async Task<List<string>> TagSlugsAsync(MathCompsDbContext context) =>
        await context.ProblemTags
            .Join(context.Tags, problemTag => problemTag.TagId, tag => tag.Id, (_, tag) => tag.Slug)
            .OrderBy(slug => slug)
            .ToListAsync();

    /// <summary>
    /// Reads the category stored for a tag slug.
    /// </summary>
    /// <param name="context">The query context.</param>
    /// <param name="slug">The slug to look up.</param>
    /// <returns>The tag's category.</returns>
    private static async Task<TagType> TagTypeOfAsync(MathCompsDbContext context, string slug) =>
        (await context.Tags.SingleAsync(tag => tag.Slug == slug)).TagType;

    /// <summary>
    /// The round date every draft in these tests imports under.
    /// </summary>
    private static DateOnly RoundDate => new(2024, 3, 15);

    /// <summary>
    /// Builds the draft target for the csmo-a-iii · 2024 round.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget CsmoTarget() => new("csmo-a-iii", 2024);

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
    /// <param name="authors">The author names in order, or null for no <c>authors:</c> key.</param>
    /// <param name="texts">The problem's text variants.</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent ProblemBy(
        int order, ImmutableArray<string>? authors, params DraftTextContent[] texts) =>
        new(order, HasSidecar: true, authors, SolutionLink: null, Tags: null, Texts: [.. texts], Images: []);

    /// <summary>
    /// Builds a draft problem carrying the given tags and a single author.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="tags">The tag slugs, or null for no <c>tags:</c> key.</param>
    /// <param name="texts">The problem's text variants.</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent ProblemWithTags(
        int order, ImmutableArray<string>? tags, params DraftTextContent[] texts) =>
        new(order, HasSidecar: true, ["Jaromír Šimša"], SolutionLink: null, Tags: tags, Texts: [.. texts], Images: []);

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
