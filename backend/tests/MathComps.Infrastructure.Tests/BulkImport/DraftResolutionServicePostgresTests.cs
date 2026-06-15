using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Integration tests for <see cref="DraftResolutionService"/> against a real Postgres database. These pin the EF
/// query field mappings a pure slug test can't reach — the round lookup keys on <c>CompositeSlug</c> (category
/// included), the season on <c>StartYear</c>, the per-text check on <c>Problem.Slug</c> plus each text's
/// <c>(DocumentType, Language, IsOriginal, MarkdownText)</c> — and that each entity resolves independently, so a
/// draft can reuse some of its taxonomy while creating the rest, and that the import outcome for each existing text
/// variant is classified from that text's language, originality and whether its stored body actually differs.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftResolutionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftResolutionService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // Register the bulk-import module the test resolves from
        services.AddBulkImport();

    /// <summary>
    /// The slug of the one seeded text problem — it carries a Slovak original statement and an English statement
    /// translation, both with the body <see cref="SeededBody"/>, and no solution, so every per-text outcome can be
    /// exercised against it.
    /// </summary>
    private const string SeededProblemSlug = "74-csmo-a-iii-1";

    /// <summary>
    /// The slug of the seeded image-bearing problem — its statement stores the rewritten <c>media:</c> ref, so a
    /// re-import of the same figure can be told apart as unchanged.
    /// </summary>
    private const string ImageProblemSlug = "74-csmo-a-iii-2";

    /// <summary>
    /// The body both of the seeded problem 1's texts hold; a draft carrying the same body is an unchanged re-import,
    /// a different one is an overwrite.
    /// </summary>
    private const string SeededBody = "seed";

    /// <summary>
    /// The statement markdown (with its relative image ref) the seeded image problem was built from; the draft in
    /// the unchanged-image test replays it verbatim.
    /// </summary>
    private const string ImageStatement = "see ![f](images/fig.svg)";

    /// <summary>
    /// The draft folder holding the image problem's SVG — created during seeding so the stored body and the test's
    /// would-be body are both sized off the same file.
    /// </summary>
    private string _imageFolder = "";

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // One existing CSMO category-A national round in the 2024 season, carrying its problems.
        var competition = new Competition { Id = Guid.NewGuid(), Slug = "csmo", SortOrder = 1 };
        context.Competitions.Add(competition);

        // Season keyed on its start year.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2024, EditionNumber = 74 };
        context.Seasons.Add(season);

        // Round keyed on its composite slug; category is irrelevant to the lookup, so leave it null.
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Slug = "iii",
            CompositeSlug = "csmo-a-iii",
            SortOrder = 1,
            IsDefault = false
        };
        context.Rounds.Add(round);

        // The round-instance the problems hang off.
        var roundInstance = new RoundInstance
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            SeasonId = season.Id,
            Date = new DateOnly(2024, 3, 15)
        };
        context.RoundInstances.Add(roundInstance);

        // The text problem a re-import of problem 1 lands on.
        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            RoundInstanceId = roundInstance.Id,
            Number = 1,
            Slug = SeededProblemSlug
        };
        context.Problems.Add(problem);

        // Its statement already exists as a Slovak original plus an English translation, both holding the same body;
        // it has no solution. That mix lets one problem drive every classification: overwrite/unchanged/second
        // original on the statement, an add on the missing solution, and add/overwrite/unchanged across languages.
        context.ProblemTexts.Add(SeedText(problem.Id, DocumentType.Statement, Language.SK, isOriginal: true));
        context.ProblemTexts.Add(SeedText(problem.Id, DocumentType.Statement, Language.EN, isOriginal: false));

        // A draft folder for the image problem's figure.
        _imageFolder = Path.Combine(Path.GetTempPath(), $"bulkimport-resolution-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(_imageFolder, "images"));

        // The figure the image statement references, sized so its intrinsic dimensions can be read back.
        await File.WriteAllTextAsync(
            Path.Combine(_imageFolder, "images", "fig.svg"), "<svg width=\"100px\" height=\"80px\"></svg>");

        // The stored body, rewritten to the media ref exactly as the import would — so a verbatim replay matches it.
        var imageBody = MarkdownImageRewriter.Rewrite(
            ImageStatement, ProblemImageRefs.BuildReplacements(["fig.svg"], ImageProblemSlug, _imageFolder));

        // The image problem the unchanged-image test re-imports.
        var imageProblem = new Problem
        {
            Id = Guid.NewGuid(),
            RoundInstanceId = roundInstance.Id,
            Number = 2,
            Slug = ImageProblemSlug
        };
        context.Problems.Add(imageProblem);

        // Its statement holds the rewritten media body.
        context.ProblemTexts.Add(
            SeedText(imageProblem.Id, DocumentType.Statement, Language.SK, isOriginal: true, markdown: imageBody));

        // A category-less competition and round, so the null-category composite slug ("memo-i") gets exercised.
        var memo = new Competition { Id = Guid.NewGuid(), Slug = "memo", SortOrder = 2 };
        context.Competitions.Add(memo);
        context.Rounds.Add(new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = memo.Id,
            Slug = "i",
            CompositeSlug = "memo-i",
            SortOrder = 1,
            IsDefault = false
        });

        // Persist the chain.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A draft targeting the seeded round reuses every taxonomy entity (this proves the lookups; the per-text
    /// outcomes are covered by the resolution tests below).
    /// </summary>
    [Fact]
    public Task Existing_taxonomy_is_reused() => RunTestAsync(async service =>
    {
        // Preview a one-problem original draft against the seeded csmo/a/iii · 2024 round.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK)));

        // All three taxonomy entities already exist, so all reuse.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));
    });

    /// <summary>
    /// A draft for an unseen competition / season / round reports all three as creates, and a net-new problem
    /// produces no per-text resolution.
    /// </summary>
    [Fact]
    public Task Unknown_taxonomy_is_reported_as_creates_with_no_resolutions() => RunTestAsync(async service =>
    {
        // Preview a draft whose competition, round and season are all absent.
        var preview = await PreviewAsync(
            service, new DraftTarget("newcomp", null, "i", 2099), Problem(1, Original(Language.SK)));

        // Nothing exists yet, so all three would be created.
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));

        // The brand-new problem slug carries no existing texts, so there's nothing to resolve.
        Assert.Empty(preview.TextResolutions);
    });

    /// <summary>
    /// Each entity resolves independently: a draft reusing the seeded competition and round but in a brand-new
    /// season reports the season alone as a create, and the new year's slug is net-new (no resolution).
    /// </summary>
    [Fact]
    public Task A_new_season_under_an_existing_competition_and_round_creates_only_the_season() => RunTestAsync(async service =>
    {
        // Same csmo/a/iii round, but the 2025 season doesn't exist yet.
        var preview = await PreviewAsync(
            service, new DraftTarget("csmo", "a", "iii", 2025), Problem(1, Original(Language.SK)));

        // Competition and round are reused; only the season is new.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));

        // The 2025 slug is distinct from the seeded 2024 one, so there's no existing text to resolve.
        Assert.Empty(preview.TextResolutions);
    });

    /// <summary>
    /// The category is part of the round key: the same competition and round under a different category resolves
    /// to a different composite slug, so the round reads as a create.
    /// </summary>
    [Fact]
    public Task A_different_category_resolves_to_a_new_round() => RunTestAsync(async service =>
    {
        // csmo/b/iii composes to "csmo-b-iii", which isn't the seeded "csmo-a-iii".
        var preview = await PreviewAsync(
            service, new DraftTarget("csmo", "b", "iii", 2024), Problem(1, Original(Language.SK)));

        // The competition and season still exist; the differently-keyed round does not.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));
    });

    /// <summary>
    /// A category-less competition's round resolves by the category-less composite slug ("memo-i"), so the
    /// seeded round is reused.
    /// </summary>
    [Fact]
    public Task A_category_less_round_resolves_by_its_composite_slug() => RunTestAsync(async service =>
    {
        // memo/(no category)/i composes to "memo-i", which is seeded.
        var preview = await PreviewAsync(
            service, new DraftTarget("memo", null, "i", 2024), Problem(1, Original(Language.SK)));

        // All three exist, so all reuse — proving the null-category composite matched the stored slug.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "round"));
    });

    /// <summary>
    /// A brand-new problem importing its original plus translations is entirely quiet — every classifier reports
    /// nothing on a net-new slug, so the translations are never mistaken for orphans.
    /// </summary>
    [Fact]
    public Task A_fresh_problem_with_translations_is_quiet() => RunTestAsync(async service =>
    {
        // Problem 3's slug ("74-csmo-a-iii-3") doesn't exist; import its Slovak original plus EN and CS texts.
        var preview = await PreviewAsync(
            service, Problem(3, Original(Language.SK), Translation(Language.EN), Translation(Language.CS)));

        // Nothing lands on an existing slug, so there is nothing to report.
        Assert.Empty(preview.TextResolutions);
    });

    /// <summary>
    /// Re-importing the original in its own language with a different body overwrites the existing original in place,
    /// while the solution half — which the seeded problem lacks — is reported as a clean add.
    /// </summary>
    [Fact]
    public Task Same_language_original_overwrites_and_a_missing_solution_is_a_clean_add() => RunTestAsync(async service =>
    {
        // Slovak original draft for the seeded problem, with a changed body and a solution it doesn't have yet.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK, hasSolution: true)));

        // The Slovak statement original is overwritten in place; the absent solution is added cleanly.
        Assert.Equal(DraftTextAction.OverwriteOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
        Assert.Equal(DraftTextAction.AddOriginal, ResolutionFor(preview, DocumentType.Solution).Action);
    });

    /// <summary>
    /// Re-importing the original with the exact stored body is recognised as unchanged — no overwrite is reported.
    /// </summary>
    [Fact]
    public Task Same_language_original_with_an_identical_body_is_unchanged() => RunTestAsync(async service =>
    {
        // Slovak original draft whose body matches the seeded one byte-for-byte.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK, SeededBody)));

        // Identical content changes nothing, so it's classified unchanged rather than overwrite.
        Assert.Equal(DraftTextAction.UnchangedOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// An original in a different language than the stored original is the forbidden second-original case.
    /// </summary>
    [Fact]
    public Task A_different_language_original_is_rejected_as_a_second_original() => RunTestAsync(async service =>
    {
        // Czech original draft — but the statement's stored original is Slovak.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.CS)));

        // Importing it as an original would create a second original for the statement.
        Assert.Equal(DraftTextAction.SecondOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// Importing the original alongside a brand-new-language translation overwrites the original and adds the
    /// translation cleanly — the multi-text path classifies each variant on its own.
    /// </summary>
    [Fact]
    public Task Adding_a_language_overwrites_the_original_and_adds_the_translation() => RunTestAsync(async service =>
    {
        // The seeded problem's Slovak original (changed body) plus a fresh Czech translation.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK), Translation(Language.CS)));

        // The Slovak original is overwritten; the Czech translation is a clean add.
        Assert.Equal(
            DraftTextAction.OverwriteOriginal,
            ResolutionFor(preview, DocumentType.Statement, Language.SK).Action);
        Assert.Equal(
            DraftTextAction.AddTranslation,
            ResolutionFor(preview, DocumentType.Statement, Language.CS).Action);
    });

    /// <summary>
    /// A translation in a language the problem doesn't have yet attaches cleanly onto the existing original.
    /// </summary>
    [Fact]
    public Task A_translation_in_a_new_language_is_a_clean_add() => RunTestAsync(async service =>
    {
        // Czech translation draft — the statement has a Slovak original but no Czech text.
        var preview = await PreviewAsync(service, Problem(1, Translation(Language.CS)));

        // The Czech translation is a clean add.
        Assert.Equal(DraftTextAction.AddTranslation, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// A translation in a language already present, with a different body, overwrites that text in place.
    /// </summary>
    [Fact]
    public Task A_translation_in_an_existing_language_overwrites_in_place() => RunTestAsync(async service =>
    {
        // English translation draft with a changed body — the statement already carries an English translation.
        var preview = await PreviewAsync(service, Problem(1, Translation(Language.EN)));

        // The existing English translation is overwritten in place.
        Assert.Equal(DraftTextAction.OverwriteTranslation, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// A translation re-imported with the exact stored body is recognised as unchanged — no overwrite is reported.
    /// </summary>
    [Fact]
    public Task A_translation_with_an_identical_body_is_unchanged() => RunTestAsync(async service =>
    {
        // English translation draft whose body matches the seeded one byte-for-byte.
        var preview = await PreviewAsync(service, Problem(1, Translation(Language.EN, SeededBody)));

        // Identical content changes nothing, so it's classified unchanged rather than overwrite.
        Assert.Equal(DraftTextAction.UnchangedTranslation, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// A re-import of an image-bearing statement, sized off the same SVG, reproduces the stored <c>media:</c> body
    /// exactly and is recognised as unchanged — the preview's image-ref rewrite matches the apply path's.
    /// </summary>
    [Fact]
    public Task An_unchanged_image_body_is_detected() => RunTestAsync(async service =>
    {
        // Replay the image problem's statement verbatim, sized off the same on-disk figure.
        var problem = new DraftProblemContent(
            2, [], SolutionLink: null, Tags: null, Texts: [Original(Language.SK, ImageStatement)], Images: ["fig.svg"]);
        var preview = await service.PreviewAsync(SeededTarget(), [problem], _imageFolder);

        // The reproduced body matches the stored one, so the re-import is unchanged.
        Assert.Equal(DraftTextAction.UnchangedOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// Builds a draft target for the seeded csmo/a/iii · 2024 round.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget SeededTarget() => new("csmo", "a", "iii", 2024);

    /// <summary>
    /// Previews a single-problem draft against the seeded round, with no on-disk images.
    /// </summary>
    /// <param name="service">The resolution service under test.</param>
    /// <param name="problem">The draft problem to preview.</param>
    /// <returns>The DB preview.</returns>
    private Task<DraftDbPreview> PreviewAsync(IDraftResolutionService service, DraftProblemContent problem) =>
        PreviewAsync(service, SeededTarget(), problem);

    /// <summary>
    /// Previews a single-problem draft against the given target, with no on-disk images.
    /// </summary>
    /// <param name="service">The resolution service under test.</param>
    /// <param name="target">The taxonomy and season to resolve against.</param>
    /// <param name="problem">The draft problem to preview.</param>
    /// <returns>The DB preview.</returns>
    private Task<DraftDbPreview> PreviewAsync(
        IDraftResolutionService service, DraftTarget target, DraftProblemContent problem) =>
        service.PreviewAsync(target, [problem], _imageFolder);

    /// <summary>
    /// Builds a draft problem from its order and text variants, carrying no images.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="texts">The problem's text variants (original plus any translations).</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent Problem(int order, params DraftTextContent[] texts) =>
        new(order, Authors: [], SolutionLink: null, Tags: null, Texts: [.. texts], Images: []);

    /// <summary>
    /// Builds an original text variant. The body defaults to one that differs from the seeded body, so an original
    /// is an overwrite unless the seeded body is passed explicitly.
    /// </summary>
    /// <param name="language">The original's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <param name="hasSolution">Whether the original carries a solution half.</param>
    /// <returns>The original text content.</returns>
    private static DraftTextContent Original(Language language, string statement = "changed", bool hasSolution = false) =>
        new(language, Original: true, statement, hasSolution ? "solution" : null);

    /// <summary>
    /// Builds a translation text variant. The body defaults to one that differs from the seeded body, so a
    /// translation onto an existing language is an overwrite unless the seeded body is passed explicitly.
    /// </summary>
    /// <param name="language">The translation's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <returns>The translation text content.</returns>
    private static DraftTextContent Translation(Language language, string statement = "changed") =>
        new(language, Original: false, statement, SolutionMarkdown: null);

    /// <summary>
    /// Builds a seed <see cref="ProblemText"/> row with the fields the resolution check reads.
    /// </summary>
    /// <param name="problemId">The owning problem.</param>
    /// <param name="documentType">Which half the text is.</param>
    /// <param name="language">The text's language.</param>
    /// <param name="isOriginal">Whether it is the canonical original.</param>
    /// <param name="markdown">The stored body, defaulting to <see cref="SeededBody"/>.</param>
    /// <returns>The text row to seed.</returns>
    private static ProblemText SeedText(
        Guid problemId, DocumentType documentType, Language language, bool isOriginal, string markdown = SeededBody) =>
        new()
        {
            ProblemId = problemId,
            DocumentType = documentType,
            Language = language,
            IsOriginal = isOriginal,
            MarkdownText = markdown,
            DateModified = DateTime.UtcNow
        };

    /// <summary>
    /// Pulls the resolution action for a given entity kind out of a preview.
    /// </summary>
    /// <param name="preview">The preview to read.</param>
    /// <param name="entityKind">The entity kind (<c>competition</c>, <c>season</c>, <c>round</c>).</param>
    /// <returns>That entity's create-vs-reuse action.</returns>
    private static ResolutionAction ActionFor(DraftDbPreview preview, string entityKind) =>
        preview.Entities.Single(entity => entity.EntityKind == entityKind).Action;

    /// <summary>
    /// Pulls the single per-text resolution for a given document type out of a preview.
    /// </summary>
    /// <param name="preview">The preview to read.</param>
    /// <param name="documentType">The half whose resolution to fetch.</param>
    /// <returns>That half's resolution.</returns>
    private static ProblemTextResolution ResolutionFor(DraftDbPreview preview, DocumentType documentType) =>
        preview.TextResolutions.Single(resolution => resolution.DocumentType == documentType);

    /// <summary>
    /// Pulls the per-text resolution for a given document type and language out of a preview, for cases where a
    /// problem writes more than one variant of the same half.
    /// </summary>
    /// <param name="preview">The preview to read.</param>
    /// <param name="documentType">The half whose resolution to fetch.</param>
    /// <param name="language">The language of the variant to fetch.</param>
    /// <returns>That variant's resolution.</returns>
    private static ProblemTextResolution ResolutionFor(
        DraftDbPreview preview, DocumentType documentType, Language language) =>
        preview.TextResolutions.Single(
            resolution => resolution.DocumentType == documentType && resolution.Language == language);
}
