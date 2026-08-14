using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Integration tests for <see cref="DraftResolutionService"/> against a real Postgres database. These pin the EF
/// query field mappings a pure slug test can't reach — the competition lookup keys on
/// <see cref="Competition.Path"/>, the season on <see cref="Season.StartYear"/>, the per-text check on
/// <see cref="Problem.Slug"/> plus each text's
/// <c>(DocumentType, Language, IsOriginal, MarkdownText)</c> — and that each entity resolves independently, so a
/// draft can reuse some of its taxonomy while creating the rest, and that the import outcome for each existing text
/// variant is classified from that text's language, originality and whether its stored body actually differs.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftResolutionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftResolutionService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bulk-import module the test resolves from.
        services.AddBulkImport();

        // The metadata registry the resolution service reconciles sort orders against.
        services.AddLocalization();
    }

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
        // Season keyed on its start year.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2024, EditionNumber = 74 };
        context.Seasons.Add(season);

        // One existing sitting of CSMO's category-A national round in the 2024 season, carrying its problems,
        // under the competition node its path spells out.
        var round = new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-a-iii").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2024, 3, 15)
        };
        context.Rounds.Add(round);

        // The text problem a re-import of problem 1 lands on.
        var problem = new Problem
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
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
            RoundId = round.Id,
            Number = 2,
            Slug = ImageProblemSlug
        };
        context.Problems.Add(imageProblem);

        // Its statement holds the rewritten media body.
        context.ProblemTexts.Add(
            SeedText(imageProblem.Id, DocumentType.Statement, Language.SK, isOriginal: true, markdown: imageBody));

        // A competition whose rounds hang straight off it, plus its 2024 sitting — the two-segment path "memo-i".
        context.Rounds.Add(new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "memo-i").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2024, 8, 20)
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
        // Preview a one-problem original draft against the seeded csmo-a-iii · 2024 round.
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
            service, new DraftTarget("newcomp-i", 2099), Problem(1, Original(Language.SK)));

        // Nothing exists yet, so all three would be created.
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));

        // The brand-new problem slug carries no existing texts, so there's nothing to resolve.
        Assert.Empty(preview.TextResolutions);
    });

    /// <summary>
    /// Each entity resolves independently: a draft naming the seeded competition in a brand-new season reuses the
    /// competition but creates both the season and that season's sitting of it, and the new year's slug is net-new.
    /// </summary>
    [Fact]
    public Task A_new_season_under_an_existing_competition_creates_the_season_and_its_round() => RunTestAsync(async service =>
    {
        // Same csmo-a-iii contest, but the 2025 season doesn't exist yet.
        var preview = await PreviewAsync(
            service, new DraftTarget("csmo-a-iii", 2025), Problem(1, Original(Language.SK)));

        // The competition is reused; the season and the round it would run are both new.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));

        // The 2025 slug is distinct from the seeded 2024 one, so there's no existing text to resolve.
        Assert.Empty(preview.TextResolutions);
    });

    /// <summary>
    /// A path differing anywhere along its length addresses a different competition, so a draft naming the same
    /// round under a sibling category reads as a create for both the competition and its round.
    /// </summary>
    [Fact]
    public Task A_sibling_contest_resolves_to_a_new_competition() => RunTestAsync(async service =>
    {
        // "csmo-b-iii" differs from the seeded "csmo-a-iii" one segment in.
        var preview = await PreviewAsync(
            service, new DraftTarget("csmo-b-iii", 2024), Problem(1, Original(Language.SK)));

        // The season still exists; the differently-addressed competition and its round do not.
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(preview, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(preview, "round"));
    });

    /// <summary>
    /// A contest sitting two levels down resolves by its own two-segment path, so the seeded competition and its
    /// sitting are both reused — depth is nothing the lookup knows about.
    /// </summary>
    [Fact]
    public Task A_two_level_contest_resolves_by_its_path() => RunTestAsync(async service =>
    {
        // "memo-i" is seeded, one level shallower than the csmo rounds beside it.
        var preview = await PreviewAsync(
            service, new DraftTarget("memo-i", 2024), Problem(1, Original(Language.SK)));

        // All three exist, so all reuse — proving the shorter path matched the stored node.
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
    /// A translation-only drop onto an existing problem (no original body) classifies each translation on its own —
    /// a new language is a clean add, an existing one an in-place overwrite — and never flags a missing original,
    /// since the stored original stays untouched.
    /// </summary>
    [Fact]
    public Task A_translation_only_drop_onto_an_existing_problem_classifies_each_translation() => RunTestAsync(async service =>
    {
        // Czech and English translations of the seeded problem, with no Slovak original in the draft.
        var preview = await PreviewAsync(service, Problem(1, Translation(Language.CS), Translation(Language.EN)));

        // The Czech translation is a clean add — that language is new on the problem.
        Assert.Equal(
            DraftTextAction.AddTranslation, ResolutionFor(preview, DocumentType.Statement, Language.CS).Action);

        // The English translation is an in-place overwrite — that language already exists.
        Assert.Equal(
            DraftTextAction.OverwriteTranslation, ResolutionFor(preview, DocumentType.Statement, Language.EN).Action);

        // Nothing is flagged as a missing original — the stored Slovak original is left in place.
        Assert.DoesNotContain(
            preview.TextResolutions,
            resolution => resolution.Action == DraftTextAction.NoOriginalForNewProblem);
    });

    /// <summary>
    /// A translation-only drop onto a problem that doesn't exist yet is the forbidden no-original-new-problem case —
    /// importing it would insert a problem with only translations and no canonical original.
    /// </summary>
    [Fact]
    public Task A_translation_only_drop_onto_a_missing_problem_is_rejected() => RunTestAsync(async service =>
    {
        // Problem 3's slug ("74-csmo-a-iii-3") doesn't exist; the draft carries only translations, no original.
        var preview = await PreviewAsync(service, Problem(3, Translation(Language.CS), Translation(Language.EN)));

        // Exactly one resolution comes back — the whole problem is flagged once, not per-half.
        var resolution = Assert.Single(preview.TextResolutions);

        // And it's the no-original conflict — no existing original to attach the translations to.
        Assert.Equal(DraftTextAction.NoOriginalForNewProblem, resolution.Action);
    });

    /// <summary>
    /// Correcting one existing problem's original in a subset draft — the round already holds it — leaves the round
    /// contiguous, so no gap is flagged. This is the single-problem original correction the relocated contiguity
    /// check is meant to allow.
    /// </summary>
    [Fact]
    public Task A_subset_reimport_of_an_existing_original_leaves_the_round_contiguous() => RunTestAsync(async service =>
    {
        // A Slovak original correction for the seeded problem 1 (the round already holds problems 1 and 2).
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK)));

        // The original is overwritten in place, and the round stays gap-free — nothing to flag.
        Assert.Equal(DraftTextAction.OverwriteOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
        Assert.Empty(preview.MissingProblemOrders);
    });

    /// <summary>
    /// Importing a problem at an order that leaves a hole — here problem 4 while the round holds only 1 and 2 — would
    /// create a gap-numbered round, so the missing order is flagged. This is the safety the DB-blind preflight can't
    /// provide: it can't tell a genuine subset re-import from a fresh import that skipped a problem.
    /// </summary>
    [Fact]
    public Task An_import_that_would_leave_a_round_gap_is_flagged() => RunTestAsync(async service =>
    {
        // Problem 4 (slug "74-csmo-a-iii-4") doesn't exist; importing it leaves order 3 missing between 1, 2 and 4.
        var preview = await PreviewAsync(service, Problem(4, Original(Language.SK)));

        // The post-import round would run 1, 2, 4 — order 3 is the gap.
        Assert.Equal(3, Assert.Single(preview.MissingProblemOrders));
    });

    /// <summary>
    /// Appending the next problem in sequence — problem 3 onto a round holding 1 and 2 — keeps the round contiguous
    /// and, with its original and metadata sidecar present, is a clean create with nothing to flag.
    /// </summary>
    [Fact]
    public Task Appending_the_next_problem_is_a_clean_contiguous_create() => RunTestAsync(async service =>
    {
        // Problem 3 is net-new but extends the round without a gap, and carries an original plus a sidecar.
        var preview = await PreviewAsync(service, Problem(3, Original(Language.SK)));

        // A clean create — no per-text conflict and no round gap.
        Assert.Empty(preview.TextResolutions);
        Assert.Empty(preview.MissingProblemOrders);
    });

    /// <summary>
    /// A net-new problem carrying an original but no <c>pN.yaml</c> sidecar is flagged — a fresh problem should
    /// declare its metadata. (A re-import onto an existing problem may omit it; this slug doesn't exist yet.)
    /// </summary>
    [Fact]
    public Task A_new_problem_with_no_metadata_sidecar_is_flagged() => RunTestAsync(async service =>
    {
        // Problem 3 is net-new (so importing creates it), carries a Slovak original, but has no sidecar.
        var preview = await PreviewAsync(service, Problem(3, hasSidecar: false, Original(Language.SK)));

        // The whole problem is flagged once as missing its metadata.
        var resolution = Assert.Single(preview.TextResolutions);
        Assert.Equal(DraftTextAction.NewProblemMissingMetadata, resolution.Action);
    });

    /// <summary>
    /// Correcting an existing problem's original while omitting its <c>pN.yaml</c> sidecar is accepted — the
    /// missing-metadata rule fires only for a problem the import would create, never a re-import (which leaves the
    /// stored authors/tags/link untouched). This is the SK-original-correction shape the change is built for.
    /// </summary>
    [Fact]
    public Task A_subset_reimport_omitting_the_sidecar_is_accepted() => RunTestAsync(async service =>
    {
        // A Slovak original correction for the seeded problem 1, shipped with no pN.yaml.
        var preview = await PreviewAsync(service, Problem(1, hasSidecar: false, Original(Language.SK)));

        // The original is overwritten in place, and nothing is flagged as missing metadata.
        Assert.Equal(DraftTextAction.OverwriteOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
        Assert.DoesNotContain(
            preview.TextResolutions,
            resolution => resolution.Action == DraftTextAction.NewProblemMissingMetadata);
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
            2, HasSidecar: true, Authors: [], SolutionLink: null, Tags: null,
            Texts: [Original(Language.SK, ImageStatement)], Images: ["fig.svg"]);
        var preview = await service.PreviewAsync(SeededTarget(), [problem], _imageFolder);

        // The reproduced body matches the stored one, so the re-import is unchanged.
        Assert.Equal(DraftTextAction.UnchangedOriginal, ResolutionFor(preview, DocumentType.Statement).Action);
    });

    /// <summary>
    /// The preview reports the sort-order reconciliation apply would perform: the seeded memo competition and the
    /// seeded csmo round iii both drifted from their registry positions, so each is reported as a renumbering.
    /// </summary>
    [Fact]
    public Task The_preview_reports_the_sort_order_reconciliation() => RunTestAsync(async service =>
    {
        // Preview a draft against the seeded round — the reconciliation is global, not specific to this draft.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK)));

        // The seeded memo competition sits at 2 but the registry puts it at 3.
        Assert.Contains(new SortOrderChange("memo", 2, 3), preview.SortOrderChanges);

        // The seeded csmo round iii sits at 1 but the registry puts it at 4, behind i, s and ii.
        Assert.Contains(new SortOrderChange("csmo-a-iii", 1, 4), preview.SortOrderChanges);
    });

    /// <summary>
    /// A stored competition whose slug the registry doesn't carry is surfaced as an orphan — its sort order can't be
    /// reconciled, so the preview flags it for the pipeline to block on.
    /// </summary>
    [Fact]
    public Task An_unregistered_competition_is_flagged_as_an_orphan() => RunTestAsync(async service =>
    {
        // Seed a competition whose slug is absent from the registry.
        await QueryAsync(async context =>
        {
            // The unregistered row.
            CompetitionTreeSeed.Root(context, "notacomp", 99);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Preview a draft — the orphan scan is global, not specific to this draft.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK)));

        // The unregistered competition is reported as an orphan.
        Assert.Contains(new TaxonomyOrphan("notacomp"), preview.Orphans);
    });

    /// <summary>
    /// A stored round whose slug the registry doesn't carry is surfaced as an orphan — without it a removed round
    /// slug squatting on a registry sort order would pass validate and then collide on apply.
    /// </summary>
    [Fact]
    public Task An_unregistered_round_is_flagged_as_an_orphan() => RunTestAsync(async service =>
    {
        // Seed a round under the seeded csmo category A whose slug is absent from the registry's list for it.
        await QueryAsync(async context =>
        {
            // The category the unregistered round hangs off.
            var categoryA = await context.Competitions.SingleAsync(
                competition => competition.Path == "csmo-a");

            // The unregistered round itself.
            context.Competitions.Add(new Competition
            {
                Id = Guid.NewGuid(),
                ParentId = categoryA.Id,
                Slug = "zz",
                Path = "csmo-a-zz",
                SortPath = $"{categoryA.SortPath}.0009",
                SortOrder = 9
            });

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Preview a csmo draft — the orphan scan covers every generation the chain descends through.
        var preview = await PreviewAsync(service, Problem(1, Original(Language.SK)));

        // The unregistered round is reported as an orphan.
        Assert.Contains(new TaxonomyOrphan("csmo-a-zz"), preview.Orphans);
    });

    /// <summary>
    /// Builds a draft target for the seeded csmo-a-iii · 2024 round.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget SeededTarget() => new("csmo-a-iii", 2024);

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
    /// Builds a draft problem from its order and text variants, carrying no images and (by default) a metadata
    /// sidecar.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="texts">The problem's text variants (original plus any translations).</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent Problem(int order, params DraftTextContent[] texts) =>
        Problem(order, hasSidecar: true, texts);

    /// <summary>
    /// Builds a draft problem from its order, whether it carries a metadata sidecar, and its text variants.
    /// </summary>
    /// <param name="order">The problem's 1-based order.</param>
    /// <param name="hasSidecar">Whether a <c>pN.yaml</c> sidecar exists for the problem.</param>
    /// <param name="texts">The problem's text variants (original plus any translations).</param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent Problem(int order, bool hasSidecar, params DraftTextContent[] texts) =>
        new(order, hasSidecar, Authors: [], SolutionLink: null, Tags: null, Texts: [.. texts], Images: []);

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
