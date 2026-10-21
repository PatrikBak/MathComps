using MathComps.Infrastructure.Tests.TestInfrastructure;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.BulkImport;
using MathComps.Shared.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Integration tests for what <see cref="DraftImportService"/> finds in a draft, against a real Postgres database
/// seeded with a round to import onto. Each case runs dry, since what the import finds is settled before anything is
/// kept. These pin the EF query field mappings a pure slug test can't reach: the competition found along its path one
/// generation at a time, the season on <see cref="Season.StartYear"/>, and the per-text check on
/// <see cref="Problem.Slug"/> plus each text's <c>(DocumentType, Language, IsOriginal, MarkdownText)</c>. They also pin
/// that each entity resolves independently, so a draft can reuse some of its taxonomy while creating the rest, and
/// that each existing text variant's outcome turns on that text's language, originality and whether its stored body
/// actually differs. Beyond those, they cover many of the reasons the database refuses a draft.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DraftImportFindingsPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDraftImportService>(fixture)
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bulk-import module the test resolves from.
        services.AddBulkImport();

        // The import takes its uploader lazily. None is registered, since a dry run never asks for one.
        services.AddTransient(typeof(Lazy<>), typeof(LazyService<>));
    }

    /// <summary>
    /// The date of the seeded csmo-a-iii · 2024 round; a draft carrying it reuses the round as it is.
    /// </summary>
    private static DateOnly SeededDate => new(2024, 3, 15);

    /// <summary>
    /// The date of the seeded memo-i · 2024 round.
    /// </summary>
    private static DateOnly MemoDate => new(2024, 8, 20);

    /// <summary>
    /// The slug of the seeded problem 1, which carries a Slovak original statement and an English statement
    /// translation, both with the body <see cref="SeededBody"/>, and no solution, so every per-text outcome can be
    /// exercised against it.
    /// </summary>
    private const string SeededProblemSlug = "74-csmo-a-iii-1";

    /// <summary>
    /// The body both of the seeded problem 1's texts hold; a draft carrying the same body is an unchanged re-import,
    /// a different one is an overwrite.
    /// </summary>
    private const string SeededBody = "seed";

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
            Date = SeededDate
        };
        context.Rounds.Add(round);

        // The problem a re-import of problem 1 lands on.
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

        // The problem filling the round's second place.
        var secondProblem = new Problem
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            Number = 2,
            Slug = "74-csmo-a-iii-2"
        };
        context.Problems.Add(secondProblem);

        // The second problem's statement, a Slovak original.
        context.ProblemTexts.Add(SeedText(secondProblem.Id, DocumentType.Statement, Language.SK, isOriginal: true));

        // A competition whose rounds hang straight off it, plus its 2024 sitting — the two-segment path "memo-i".
        context.Rounds.Add(new Round
        {
            Id = Guid.NewGuid(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "memo-i").Id,
            SeasonId = season.Id,
            Date = MemoDate
        });

        // Persist the chain.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Each entity resolves independently: a draft naming the seeded competition in a brand-new season reuses the
    /// competition but creates both the season and that season's sitting of it, and the new year's slug is net-new.
    /// </summary>
    [Fact]
    public Task A_new_season_under_an_existing_competition_creates_the_season_and_its_round() => RunTestAsync(async service =>
    {
        // Same csmo-a-iii competition, but the 2025 season doesn't exist yet.
        var findings = await DryRunAsync(
            service, new DraftTarget("csmo-a-iii", 2025, null), Problem(1, Original(Language.SK)));

        // The competition is reused; the season and the round it would run are both new.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(findings, "competition"));
        Assert.Equal(ResolutionAction.Create, ActionFor(findings, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(findings, "round"));

        // The 2025 slug is distinct from the seeded 2024 one, so there's no existing text to resolve.
        Assert.Empty(findings.TextResolutions);
    });

    /// <summary>
    /// A path differing anywhere along its length addresses a different competition, so a draft naming the same
    /// round under a sibling category reads as a create for both the competition and its round.
    /// </summary>
    [Fact]
    public Task A_sibling_path_resolves_to_a_new_competition() => RunTestAsync(async service =>
    {
        // "csmo-b-iii" differs from the seeded "csmo-a-iii" one segment in.
        var findings = await DryRunAsync(
            service, new DraftTarget("csmo-b-iii", 2024, null), Problem(1, Original(Language.SK)));

        // The season still exists; the differently-addressed competition and its round do not.
        Assert.Equal(ResolutionAction.Create, ActionFor(findings, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(findings, "season"));
        Assert.Equal(ResolutionAction.Create, ActionFor(findings, "round"));
    });

    /// <summary>
    /// A competition sitting two levels down resolves by its own two-segment path, so the seeded competition and its
    /// sitting are both reused — depth is nothing the lookup knows about.
    /// </summary>
    [Fact]
    public Task A_two_level_competition_resolves_by_its_path() => RunTestAsync(async service =>
    {
        // "memo-i" is seeded, one level shallower than the csmo rounds beside it.
        var findings = await DryRunAsync(
            service, new DraftTarget("memo-i", 2024, null), Problem(1, Original(Language.SK)), MemoDate);

        // All three exist, so all reuse — proving the shorter path matched the stored node.
        Assert.Equal(ResolutionAction.Reuse, ActionFor(findings, "competition"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(findings, "season"));
        Assert.Equal(ResolutionAction.Reuse, ActionFor(findings, "round"));
    });

    /// <summary>
    /// A brand-new problem importing its original plus translations is a create in every language it carries, and
    /// no text of it is classified, so the translations are never mistaken for orphans.
    /// </summary>
    [Fact]
    public Task A_fresh_problem_is_a_create_in_every_language() => RunTestAsync(async service =>
    {
        // Problem 3's slug ("74-csmo-a-iii-3") doesn't exist; import its Slovak original plus EN and CS texts.
        var findings = await DryRunAsync(
            service, Problem(3, Original(Language.SK), Translation(Language.EN), Translation(Language.CS)));

        // The problem is created, in the three languages, in draft order.
        var problem = Assert.Single(findings.Problems);
        Assert.Equal(("74-csmo-a-iii-3", ResolutionAction.Create), (problem.Slug, problem.Action));
        Assert.Equal([Language.SK, Language.EN, Language.CS], problem.Languages.ToList());

        // Nothing lands on an existing slug, so no text is classified.
        Assert.Empty(findings.TextResolutions);
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
        var findings = await DryRunAsync(service, Problem(1, Translation(Language.CS), Translation(Language.EN)));

        // The Czech translation is a clean add — that language is new on the problem.
        Assert.Equal(
            DraftTextAction.AddTranslation, ResolutionFor(findings, DocumentType.Statement, Language.CS).Action);

        // The English translation is an in-place overwrite — that language already exists.
        Assert.Equal(
            DraftTextAction.OverwriteTranslation, ResolutionFor(findings, DocumentType.Statement, Language.EN).Action);

        // Nothing is flagged as a missing original — the stored Slovak original is left in place.
        Assert.DoesNotContain(
            findings.TextResolutions,
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
        var findings = await DryRunAsync(service, Problem(3, Translation(Language.CS), Translation(Language.EN)));

        // Exactly one resolution comes back — the whole problem is flagged once, not per-half.
        var resolution = Assert.Single(findings.TextResolutions);

        // And it's the no-original conflict — no existing original to attach the translations to.
        Assert.Equal(DraftTextAction.NoOriginalForNewProblem, resolution.Action);
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
        var findings = await DryRunAsync(service, Problem(4, Original(Language.SK)));

        // The post-import round would run 1, 2, 4 — order 3 is the gap.
        Assert.Equal(3, Assert.Single(findings.MissingProblemOrders));
    });

    /// <summary>
    /// A gap in a round of the proposals is not flagged, a proposal being quoted by its own number. Finalizing a
    /// board takes its problems out of that round from wherever they stand, so flagging the gaps it leaves would
    /// block every import that doesn't fill them.
    /// </summary>
    [Fact]
    public Task A_gap_in_a_round_of_the_proposals_is_not_flagged() => RunTestAsync(async service =>
    {
        // Problem 4 of a proposals round that doesn't exist yet, which leaves 1 to 3 empty.
        var findings = await DryRunAsync(
            service, new DraftTarget(HostedTaxonomy.ProposalsPath, 2024, Organization.MathCompsSlug),
            Problem(4, Original(Language.SK)));

        // Nothing to flag.
        Assert.Empty(findings.MissingProblemOrders);
    });

    /// <summary>
    /// Appending the next problem in sequence — problem 3 onto a round holding 1 and 2 — keeps the round contiguous
    /// and, with its original and metadata sidecar present, is a clean create with nothing to flag.
    /// </summary>
    [Fact]
    public Task Appending_the_next_problem_is_a_clean_contiguous_create() => RunTestAsync(async service =>
    {
        // Problem 3 is net-new but extends the round without a gap, and carries an original plus a sidecar.
        var findings = await DryRunAsync(service, Problem(3, Original(Language.SK)));

        // A clean create — no per-text conflict and no round gap.
        Assert.Empty(findings.TextResolutions);
        Assert.Empty(findings.MissingProblemOrders);
    });

    /// <summary>
    /// A net-new problem carrying an original but no <c>pN.yaml</c> sidecar is flagged — a fresh problem should
    /// declare its metadata. (A re-import onto an existing problem may omit it; this slug doesn't exist yet.)
    /// </summary>
    [Fact]
    public Task A_new_problem_with_no_metadata_sidecar_is_flagged() => RunTestAsync(async service =>
    {
        // Problem 3 is net-new (so importing creates it), carries a Slovak original, but has no sidecar.
        var findings = await DryRunAsync(service, Problem(3, hasSidecar: false, Original(Language.SK)));

        // The whole problem is flagged once as missing its metadata.
        var resolution = Assert.Single(findings.TextResolutions);
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
        var findings = await DryRunAsync(service, Problem(1, hasSidecar: false, Original(Language.SK)));

        // The original is overwritten in place, and nothing is flagged as missing metadata.
        Assert.Equal(DraftTextAction.OverwriteOriginal, ResolutionFor(findings, DocumentType.Statement).Action);
        Assert.DoesNotContain(
            findings.TextResolutions,
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
        var findings = await DryRunAsync(service, Problem(1, Original(Language.SK, hasSolution: true)));

        // The Slovak statement original is overwritten in place; the absent solution is added cleanly.
        Assert.Equal(DraftTextAction.OverwriteOriginal, ResolutionFor(findings, DocumentType.Statement).Action);
        Assert.Equal(DraftTextAction.AddOriginal, ResolutionFor(findings, DocumentType.Solution).Action);
    });

    /// <summary>
    /// An original landing on a half that holds no original, only a text in the original's language, takes its body
    /// into that text the way a translation would, since that text is the one the import rewrites.
    /// </summary>
    [Fact]
    public Task An_original_onto_a_half_without_one_lands_on_its_language() => RunTestAsync(async service =>
    {
        // A Slovak solution stored as a translation, the half holding no original.
        await QueryAsync(async context =>
        {
            // The problem the solution hangs off.
            var problemId = await context.Problems
                .Where(problem => problem.Slug == SeededProblemSlug)
                .Select(problem => problem.Id)
                .SingleAsync();

            // The solution row itself, its body the one the draft carries.
            context.ProblemTexts.Add(
                SeedText(problemId, DocumentType.Solution, Language.SK, isOriginal: false, markdown: "solution"));

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // Re-import the Slovak original with that same solution.
        var findings = await DryRunAsync(service, Problem(1, Original(Language.SK, SeededBody, hasSolution: true)));

        // The solution lands on the stored Slovak text, which already holds it.
        Assert.Equal(DraftTextAction.UnchangedTranslation, ResolutionFor(findings, DocumentType.Solution).Action);
    });

    /// <summary>
    /// A stored competition whose slug the registry doesn't carry is surfaced as an orphan — its sort order can't be
    /// reconciled, so the import refuses the draft.
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

        // Dry-run a csmo draft. The orphan scan covers the roots, where the unregistered competition sits.
        var stopped = await DryRunStoppedAsync(service);

        // The unregistered competition is reported as an orphan.
        Assert.Contains(new TaxonomyOrphan("notacomp"), stopped.Orphans);
    });

    /// <summary>
    /// A stored round whose slug the registry doesn't carry is surfaced as an orphan — without it a removed round
    /// slug squatting on a registry sort order would collide with the renumbering.
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

        // Dry-run a csmo draft. The orphan scan covers every generation the chain descends through.
        var stopped = await DryRunStoppedAsync(service);

        // The unregistered round is reported as an orphan.
        Assert.Contains(new TaxonomyOrphan("csmo-a-zz"), stopped.Orphans);
    });

    /// <summary>
    /// A problem new to the pool with no proposal block is refused. Nothing would file it, and the selection reads
    /// only filed problems, so no reviewer would ever see it.
    /// </summary>
    [Fact]
    public Task A_new_pool_problem_without_a_proposal_is_refused() => RunTestAsync(async service =>
    {
        // A pick at a free place, its pN.yaml carrying no block.
        var findings = await DryRunPoolAsync(service, Pick(8, number: null));

        // The pick is refused.
        Assert.Equal(new PoolProblemWithoutProposal(PoolSlug(8)), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A proposal block outside the pool is refused, since only a problem in the pool is filed under a proposal.
    /// </summary>
    [Fact]
    public Task A_proposal_outside_the_pool_is_refused() => RunTestAsync(async service =>
    {
        // Problem 3 of the seeded CSMO round, carrying a block.
        var findings = await DryRunAsync(service, Pick(3, number: 14));

        // The block is refused.
        Assert.Equal(new ProposalOutsidePool("74-csmo-a-iii-3"), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A number stays taken once the reviewers delete its proposal. The deleted row keeps it, so a pick naming it
    /// would collide with a problem the pool no longer shows.
    /// </summary>
    [Fact]
    public Task A_number_a_deleted_proposal_holds_is_refused() => RunTestAsync(async service =>
    {
        // The pool, its place 1 holding proposal #21, deleted.
        await SeedPoolProblemAsync(place: 1, number: 21, deletedAt: DateTimeOffset.UtcNow);

        // A pick naming #21 at a free place.
        var findings = await DryRunPoolAsync(service, Pick(8, number: 21));

        // The pick is refused, naming the problem holding the number.
        Assert.Equal(new ProposalNumberTaken(PoolSlug(8), 21, PoolSlug(1)), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A number stays taken once its problem leaves the pool. Finalizing moves a problem into a round of its
    /// competition and keeps its proposal, so a pick naming that number would collide with a problem the pool no
    /// longer shows.
    /// </summary>
    [Fact]
    public Task A_number_a_finalized_problem_holds_is_refused() => RunTestAsync(async service =>
    {
        // The id of the problem holding #21, which the seed sets.
        var holderId = Guid.Empty;

        // Proposal #21, its problem already moved into a round of the October competitions.
        await QueryAsync(async context =>
        {
            // The October group, one round per category.
            var october = SelectionSeed.NewGroup(
                context, SelectionSeed.NewSeason(context), "october", DateTimeOffset.UtcNow.AddDays(10));

            // Proposal #21, standing first in its first round.
            holderId = SelectionSeed.NewProposal(context, october.Rounds.First(), number: 21, position: 1);

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // The slug the holder of #21 goes by in its round.
        var holderSlug = await QueryValueAsync(context =>
            context.Problems.Where(problem => problem.Id == holderId).Select(problem => problem.Slug).SingleAsync());

        // A pick naming #21 at a free place of the pool.
        var findings = await DryRunPoolAsync(service, Pick(8, number: 21));

        // The pick is refused, naming the problem holding the number.
        Assert.Equal(new ProposalNumberTaken(PoolSlug(8), 21, holderSlug), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A place holding a proposal the reviewers deleted is refused. The import would rewrite its texts and leave it
    /// deleted, so the draft would go on carrying a problem nobody sees.
    /// </summary>
    [Fact]
    public Task A_place_holding_a_deleted_proposal_is_refused() => RunTestAsync(async service =>
    {
        // The pool, its place 8 holding proposal #14, deleted.
        await SeedPoolProblemAsync(place: 8, number: 14, deletedAt: DateTimeOffset.UtcNow);

        // A pick naming #14 at place 8.
        var findings = await DryRunPoolAsync(service, Pick(8, number: 14));

        // The pick is refused.
        Assert.Equal(new ProposalDeleted(PoolSlug(8), 14), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A place holding another proposal than the block names is refused, since the draft describes a different
    /// problem than the one it would rewrite.
    /// </summary>
    [Fact]
    public Task A_place_holding_another_proposal_is_refused() => RunTestAsync(async service =>
    {
        // The pool, its place 8 holding proposal #14.
        await SeedPoolProblemAsync(place: 8, number: 14);

        // A pick naming #19 at place 8.
        var findings = await DryRunPoolAsync(service, Pick(8, number: 19));

        // The pick is refused.
        Assert.Equal(new PlaceHoldsAnotherProposal(PoolSlug(8), 14, 19), Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// A place holding a problem no proposal files is refused, block or not. Such a problem isn't one of the pool's,
    /// so nothing says the draft describes it.
    /// </summary>
    [Fact]
    public Task A_place_holding_an_unfiled_problem_is_refused() => RunTestAsync(async service =>
    {
        // The pool, its place 8 holding a problem nothing files.
        await SeedPoolProblemAsync(place: 8, number: null);

        // A pick naming #14 at place 8.
        var filed = await DryRunPoolAsync(service, Pick(8, number: 14));

        // A pick at place 8 with no block.
        var bare = await DryRunPoolAsync(service, Pick(8, number: null));

        // Both are refused.
        Assert.Equal(new PlaceHoldsNoProposal(PoolSlug(8)), Assert.Single(filed.ProposalConflicts));
        Assert.Equal(new PlaceHoldsNoProposal(PoolSlug(8)), Assert.Single(bare.ProposalConflicts));
    });

    /// <summary>
    /// A draft for the pool naming any embargo but the one every round of the pool carries is refused. Leaving it
    /// out would open the pool's round, and another instant would move its lock.
    /// </summary>
    [Fact]
    public Task A_pool_draft_moving_its_embargo_is_refused() => RunTestAsync(async service =>
    {
        // A draft naming no embargo at all.
        var open = Assert.IsType<DraftImportFinished>(await service.ImportAsync(
            PoolTarget(), SeededDate, visibleSince: null, [Pick(8, number: 14)], Path.GetTempPath(), dryRun: true));

        // A draft naming a competition's closing instant.
        var moved = Assert.IsType<DraftImportFinished>(await service.ImportAsync(
            PoolTarget(), SeededDate, new DateTimeOffset(2026, 10, 19, 22, 0, 0, TimeSpan.Zero), [Pick(8, number: 14)],
            Path.GetTempPath(), dryRun: true));

        // Both are refused.
        Assert.True(open.Findings.MovesProposalsEmbargo);
        Assert.True(moved.Findings.MovesProposalsEmbargo);
    });

    /// <summary>
    /// A dry run writes the draft out before it rolls back, so a draft breaking a limit only the database enforces,
    /// here an author's name longer than its column, fails the dry run the way it would fail the real import.
    /// </summary>
    [Fact]
    public Task A_dry_run_fails_on_a_limit_only_the_database_enforces() => RunTestAsync(async service =>
    {
        // A new problem 3 crediting an author whose name outruns its column.
        var problem = new DraftProblemContent(3, HasSidecar: true, Authors: [new string('a', 101)],
            SolutionLink: null, Tags: null, Proposal: null, Texts: [Original(Language.SK)], Images: []);

        // The dry run fails as the database refuses the author.
        await Assert.ThrowsAsync<DbUpdateException>(() => DryRunAsync(service, problem));
    });

    /// <summary>
    /// A pick recommended for a category the organization its draft names doesn't list is refused, even when another
    /// organization lists one of that name. So the same pick is refused for a different category in each pool.
    /// </summary>
    [Fact]
    public Task A_category_the_drafts_organization_does_not_list_is_refused() => RunTestAsync(async service =>
    {
        // The olympiad, listing a category of its own.
        await QueryAsync(async context =>
        {
            // The organization and its category.
            SelectionSeed.NewOrganization(context, "olympiad", "C");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

        // #14 at place 8, recommended for MathComps' elementary and the olympiad's category.
        var pick = Pick(8, number: 14) with
        {
            Proposal = new DraftProposal(14, "Proposal 14", ProposalArea.Algebra, ["elementary", "C"]),
        };

        // The pick through a draft for MathComps' pool.
        var mathComps = await DryRunPoolAsync(service, pick);

        // The pick through a draft for the olympiad's pool.
        var olympiad = await DryRunPoolAsync(service, OlympiadTarget(), pick);

        // MathComps refuses the olympiad's category, offering its own in the order they run.
        var mathCompsRefusal = Assert.IsType<ProposalCategoryUnknown>(Assert.Single(mathComps.ProposalConflicts));
        Assert.Equal((PoolSlug(8), "C"), (mathCompsRefusal.Slug, mathCompsRefusal.Category));
        Assert.Equal(["elementary", "intermediate", "advanced"], mathCompsRefusal.Listed);

        // The olympiad refuses MathComps' category, offering its own.
        var olympiadRefusal = Assert.IsType<ProposalCategoryUnknown>(Assert.Single(olympiad.ProposalConflicts));
        Assert.Equal((PoolSlug(8), "elementary"), (olympiadRefusal.Slug, olympiadRefusal.Category));
        Assert.Equal(["C"], olympiadRefusal.Listed);
    });

    /// <summary>
    /// A new pick at a free place under a free number, beside a re-import of a pick at its own place under its own
    /// number, files cleanly. These are the drafts that fill the pool, so none of its checks may fire on them.
    /// A re-import with no block files cleanly too, since leaving the block out leaves the proposal as it is.
    /// </summary>
    [Fact]
    public Task A_new_pick_and_a_reimport_file_cleanly() => RunTestAsync(async service =>
    {
        // The pool, its place 8 holding proposal #14.
        await SeedPoolProblemAsync(place: 8, number: 14);

        // #14 again at its place, and #19 at the next one, under the pool's embargo.
        var findings = await DryRunPoolAsync(service, Pick(8, number: 14), Pick(9, number: 19));

        // #14 again with no block.
        var bare = await DryRunPoolAsync(service, Pick(8, number: null));

        // Nothing is refused.
        Assert.Empty(findings.ProposalConflicts);
        Assert.False(findings.MovesProposalsEmbargo);
        Assert.Null(findings.OrganizationProblem);
        Assert.Empty(bare.ProposalConflicts);
    });

    /// <summary>
    /// A draft names an organization exactly where it fills a pool, and one that exists. A pool draft naming none
    /// would file its proposals under nobody, one naming a slug nothing goes by under nothing, and a draft outside the
    /// pool fills no organization's pool at all.
    /// </summary>
    [Fact]
    public Task A_draft_names_an_existing_organization_where_it_fills_a_pool_alone() => RunTestAsync(async service =>
    {
        // A pool draft naming no organization.
        var unnamed = await DryRunPoolAsync(
            service, new DraftTarget(HostedTaxonomy.ProposalsPath, 2026, null), Pick(8, number: 14));

        // A pool draft naming a slug no organization goes by.
        var unknown = await DryRunPoolAsync(
            service, new DraftTarget(HostedTaxonomy.ProposalsPath, 2026, "nobody"), Pick(8, number: 14));

        // A draft outside the pool naming MathComps.
        var outside = await DryRunAsync(
            service, new DraftTarget("csmo-a-iii", 2024, Organization.MathCompsSlug),
            Problem(1, Original(Language.SK)));

        // Each refused for its own reason.
        Assert.Equal(
            (DraftOrganizationProblem.Missing, DraftOrganizationProblem.Unknown, DraftOrganizationProblem.OutsidePool),
            (unnamed.OrganizationProblem, unknown.OrganizationProblem, outside.OrganizationProblem));
    });

    /// <summary>
    /// A number counts within its organization's pool, so the olympiad's draft names a number MathComps' pool already
    /// holds and files cleanly.
    /// </summary>
    [Fact]
    public Task A_number_another_pool_holds_is_free() => RunTestAsync(async service =>
    {
        // MathComps' pool, its place 1 holding proposal #21, and the olympiad beside it.
        await SeedPoolProblemAsync(place: 1, number: 21);
        await SeedOlympiadAsync();

        // The olympiad's pick naming #21 at a free place.
        var findings = await DryRunPoolAsync(service, OlympiadTarget(), Pick(8, number: 21));

        // Nothing is refused.
        Assert.Empty(findings.ProposalConflicts);
        Assert.Null(findings.OrganizationProblem);
    });

    /// <summary>
    /// A place holding another organization's proposal is refused, whatever number the block names, since a draft
    /// for one pool may not rewrite a problem of another.
    /// </summary>
    [Fact]
    public Task A_place_another_pool_holds_is_refused() => RunTestAsync(async service =>
    {
        // MathComps' pool, its place 8 holding proposal #14, and the olympiad beside it.
        await SeedPoolProblemAsync(place: 8, number: 14);
        await SeedOlympiadAsync();

        // The olympiad's pick naming #14 at place 8.
        var findings = await DryRunPoolAsync(service, OlympiadTarget(), Pick(8, number: 14));

        // Refused for that alone, naming the pool the place is in.
        Assert.Equal(
            new PlaceHoldsAnotherPoolsProposal(PoolSlug(8), 14, Organization.MathCompsSlug),
            Assert.Single(findings.ProposalConflicts));
    });

    /// <summary>
    /// Seeds the olympiad, the organization beside MathComps, with nobody on its list.
    /// </summary>
    /// <returns>A task representing the seeding.</returns>
    private Task SeedOlympiadAsync() =>
        QueryAsync(async context =>
        {
            // The olympiad
            SelectionSeed.NewOrganization(context, "olympiad");

            // Persist the seed.
            await context.SaveChangesAsync();
        });

    /// <summary>
    /// Seeds the pool's round in the 2026 season, holding one problem at the given place under the slug the import
    /// gives it, filed by a proposal when a number is given.
    /// </summary>
    /// <param name="place">The problem's place, its number in the round.</param>
    /// <param name="number">The number of the proposal filing the problem, or null when nothing files it.</param>
    /// <param name="deletedAt"><inheritdoc cref="Proposal.DeletedAt" path="/summary"/></param>
    /// <returns>A task representing the seeding.</returns>
    private Task SeedPoolProblemAsync(int place, int? number, DateTimeOffset? deletedAt = null) =>
        QueryAsync(async context =>
        {
            // The pool's round in its season.
            var round = SelectionSeed.NewProposalsRound(context, SelectionSeed.NewSeason(context));

            // The problem at the place.
            var problem = new Problem
            {
                Id = Guid.NewGuid(),
                RoundId = round.Id,
                Number = place,
                Slug = PoolSlug(place),
            };
            context.Problems.Add(problem);

            // The proposal filing the problem, when a number is given.
            if (number is { } filed)
                context.Proposals.Add(new Proposal
                {
                    ProblemId = problem.Id,
                    OrganizationId = SelectionSeed.MathCompsId(context),
                    Number = filed,
                    Title = $"Proposal {filed}",
                    Area = ProposalArea.Algebra,
                    DeletedAt = deletedAt,
                });

            // Persist the seed.
            await context.SaveChangesAsync();
        });

    /// <summary>
    /// Builds a draft target for the seeded csmo-a-iii · 2024 round.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget SeededTarget() => new("csmo-a-iii", 2024, null);

    /// <summary>
    /// Builds a draft target for the 2026 round of the pool, filling MathComps' pool.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget PoolTarget() => new(HostedTaxonomy.ProposalsPath, 2026, Organization.MathCompsSlug);

    /// <summary>
    /// Builds a draft target for the 2026 round of the pool, filling the olympiad's pool.
    /// </summary>
    /// <returns>The configured target.</returns>
    private static DraftTarget OlympiadTarget() => new(HostedTaxonomy.ProposalsPath, 2026, "olympiad");

    /// <summary>
    /// Builds the slug the import gives a place in the 2026 round of the pool, whose edition is 76.
    /// </summary>
    /// <param name="place">The place, a problem's number in the round.</param>
    /// <returns>The slug.</returns>
    private static string PoolSlug(int place) => $"76-mathcomps-proposals-{place}";

    /// <summary>
    /// Dry-runs a draft for the 2026 round of MathComps' pool, under
    /// <see cref="HostedTaxonomy.ProposalsVisibleSince"/>.
    /// </summary>
    /// <param name="service">The import service under test.</param>
    /// <param name="problems">The draft's problems.</param>
    /// <returns>What the import would do.</returns>
    private static Task<DraftImportFindings> DryRunPoolAsync(
        IDraftImportService service, params DraftProblemContent[] problems) =>
        DryRunPoolAsync(service, PoolTarget(), problems);

    /// <summary>
    /// Dry-runs a draft for a round of the pool, under <see cref="HostedTaxonomy.ProposalsVisibleSince"/>.
    /// </summary>
    /// <param name="service">The import service under test.</param>
    /// <param name="target">The pool's round, and the organization whose pool the draft fills.</param>
    /// <param name="problems">The draft's problems.</param>
    /// <returns>What the import would do.</returns>
    private static async Task<DraftImportFindings> DryRunPoolAsync(
        IDraftImportService service, DraftTarget target, params DraftProblemContent[] problems) =>
        // What the dry run found, going through the whole draft
        Assert.IsType<DraftImportFinished>(await service.ImportAsync(
            target, SeededDate, HostedTaxonomy.ProposalsVisibleSince, problems, Path.GetTempPath(), dryRun: true))
            .Findings;

    /// <summary>
    /// Builds a pick: a problem whose one text is an English original, carrying a <c>proposal:</c> block naming the
    /// given number, or none.
    /// </summary>
    /// <param name="order">The pick's place.</param>
    /// <param name="number">
    /// The number its <c>proposal:</c> block names, or null for a <c>pN.yaml</c> with no block.
    /// </param>
    /// <returns>The configured problem content.</returns>
    private static DraftProblemContent Pick(int order, int? number) =>
        new(order, HasSidecar: true, Authors: [], SolutionLink: null, Tags: null,
            Proposal: number is { } filed
                ? new DraftProposal(filed, $"Proposal {filed}", ProposalArea.Algebra, [])
                : null,
            Texts: [Original(Language.EN)], Images: []);

    /// <summary>
    /// Dry-runs a single-problem draft against the seeded round, with no on-disk images.
    /// </summary>
    /// <param name="service">The import service under test.</param>
    /// <param name="problem">The draft problem to dry-run.</param>
    /// <returns>What the import would do.</returns>
    private static Task<DraftImportFindings> DryRunAsync(IDraftImportService service, DraftProblemContent problem) =>
        DryRunAsync(service, SeededTarget(), problem);

    /// <summary>
    /// Dry-runs a single-problem draft against the given target, with no on-disk images and no embargo.
    /// </summary>
    /// <param name="service">The import service under test.</param>
    /// <param name="target">The taxonomy and season to resolve against.</param>
    /// <param name="problem">The draft problem to dry-run.</param>
    /// <param name="date">The round's date, or null for the seeded round's.</param>
    /// <returns>What the import would do.</returns>
    private static async Task<DraftImportFindings> DryRunAsync(
        IDraftImportService service, DraftTarget target, DraftProblemContent problem, DateOnly? date = null) =>
        // What the dry run found, going through the whole draft
        Assert.IsType<DraftImportFinished>(await service.ImportAsync(
            target, date ?? SeededDate, visibleSince: null, [problem], Path.GetTempPath(), dryRun: true))
            .Findings;

    /// <summary>
    /// Dry-runs a single-problem draft against the seeded round, expecting the import to stop at a stored competition
    /// node the registry can't place.
    /// </summary>
    /// <param name="service">The import service under test.</param>
    /// <returns>Where the import stopped.</returns>
    private static async Task<DraftImportStoppedAtOrphans> DryRunStoppedAsync(IDraftImportService service) =>
        // The dry run, which stopped at the orphans
        Assert.IsType<DraftImportStoppedAtOrphans>(await service.ImportAsync(
            SeededTarget(), SeededDate, visibleSince: null, [Problem(1, Original(Language.SK))], Path.GetTempPath(),
            dryRun: true));

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
        new(order, hasSidecar, Authors: [], SolutionLink: null, Tags: null, Proposal: null, Texts: [.. texts],
            Images: []);

    /// <summary>
    /// Builds an original text variant. The body defaults to one that differs from the seeded body, so an original
    /// is an overwrite unless the seeded body is passed explicitly.
    /// </summary>
    /// <param name="language">The original's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <param name="hasSolution">Whether the original carries a solution half.</param>
    /// <param name="hints">The author's hints the original carries, weakest nudge first.</param>
    /// <returns>The original text content.</returns>
    private static DraftTextContent Original(
        Language language, string statement = "changed", bool hasSolution = false, params string[] hints) =>
        new(language, Original: true, statement, hasSolution ? "solution" : null, [.. hints]);

    /// <summary>
    /// Builds a translation text variant. The body defaults to one that differs from the seeded body, so a
    /// translation onto an existing language is an overwrite unless the seeded body is passed explicitly.
    /// </summary>
    /// <param name="language">The translation's language.</param>
    /// <param name="statement">The statement markdown.</param>
    /// <returns>The translation text content.</returns>
    private static DraftTextContent Translation(Language language, string statement = "changed") =>
        new(language, Original: false, statement, SolutionMarkdown: null, Hints: []);

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
    /// Pulls the resolution action for a given entity kind out of what an import found. For a competition, that is the
    /// deepest one on the path, the competition the draft's round belongs to.
    /// </summary>
    /// <param name="findings">What the import found.</param>
    /// <param name="entityKind">The entity kind (<c>competition</c>, <c>season</c>, <c>round</c>).</param>
    /// <returns>That entity's create-vs-reuse action.</returns>
    private static ResolutionAction ActionFor(DraftImportFindings findings, string entityKind) =>
        findings.Entities.Last(entity => entity.EntityKind == entityKind).Action;

    /// <summary>
    /// Pulls the single per-text resolution for a given document type out of what an import found.
    /// </summary>
    /// <param name="findings">What the import found.</param>
    /// <param name="documentType">The half whose resolution to fetch.</param>
    /// <returns>That half's resolution.</returns>
    private static ProblemTextResolution ResolutionFor(DraftImportFindings findings, DocumentType documentType) =>
        findings.TextResolutions.Single(resolution => resolution.DocumentType == documentType);

    /// <summary>
    /// Pulls the per-text resolution for a given document type and language out of what an import found, for cases
    /// where a problem writes more than one variant of the same half.
    /// </summary>
    /// <param name="findings">What the import found.</param>
    /// <param name="documentType">The half whose resolution to fetch.</param>
    /// <param name="language">The language of the variant to fetch.</param>
    /// <returns>That variant's resolution.</returns>
    private static ProblemTextResolution ResolutionFor(
        DraftImportFindings findings, DocumentType documentType, Language language) =>
        findings.TextResolutions.Single(
            resolution => resolution.DocumentType == documentType && resolution.Language == language);
}
