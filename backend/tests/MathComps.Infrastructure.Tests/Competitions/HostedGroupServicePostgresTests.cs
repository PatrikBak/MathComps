using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Integration tests for the group manifest: what it refuses before writing anything, and what re-declaring a
/// corrected one does to the group it already created.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class HostedGroupServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IHostedGroupService>(fixture)
{
    /// <summary>
    /// The season every seeded round sits in.
    /// </summary>
    private const int SeasonYear = 2026;

    /// <summary>
    /// When the group closes, which is also when its problems come out.
    /// </summary>
    private static readonly DateTimeOffset _closesAt =
        new(2026, 10, 31, 22, 0, 0, TimeSpan.Zero);

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test.
        services.AddScoped<IHostedGroupService, HostedGroupService>();

    /// <summary>
    /// Verifies that a manifest writing its instants in a local offset is stored as the same instants.
    /// </summary>
    /// <remarks>
    /// Every other test here builds its instants in UTC, which is the only offset the provider accepts, so this
    /// is the one case covering the form the tool's README tells an author to write. The offset itself is not
    /// kept, and is not meant to be: what has to survive is the instant.
    /// </remarks>
    [Fact]
    public Task A_manifest_written_in_a_local_offset_keeps_its_instants() => RunTestAsync(async service =>
    {
        // The same window the other tests use, written the way an author in Bratislava would write it
        var opensAt = _closesAt.AddDays(-30).ToOffset(TimeSpan.FromHours(2));
        var closesAt = _closesAt.ToOffset(TimeSpan.FromHours(1));

        // Declared, which is where the provider would refuse a non-zero offset
        var declared = await service.DeclareAsync(
            Manifest("mc-advanced") with { OpensAt = opensAt, ClosesAt = closesAt });

        // The group as it was stored
        var stored = await QueryValueAsync(context => context.HostedGroups
            .Where(group => group.Id == declared.GroupId)
            .Select(group => new { group.OpensAt, group.ClosesAt })
            .FirstAsync());

        // The same two instants, whatever offset each of them now reads in
        Assert.Equal(opensAt, stored.OpensAt);
        Assert.Equal(closesAt, stored.ClosesAt);
    });

    /// <summary>
    /// Verifies that a manifest naming its rounds creates the group and links exactly them.
    /// </summary>
    [Fact]
    public Task A_manifest_creates_the_group_and_links_its_rounds() => RunTestAsync(async service =>
    {
        // Declare it
        var outcome = await service.DeclareAsync(Manifest("mc-elementary", "mc-advanced"));

        // Which put the group there
        Assert.True(outcome.Created);

        // Running both rounds
        Assert.Equal(2, outcome.RoundsLinked);

        // Each holding the same set
        Assert.Equal(2, outcome.ProblemCount);

        // And the rounds now say which group they belong to
        Assert.Equal(
            2,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId == outcome.GroupId)));
    });

    /// <summary>
    /// Verifies that re-declaring under the same slug updates the group rather than creating a second one, and
    /// that a round dropped from the manifest is released rather than left claiming membership.
    /// </summary>
    [Fact]
    public Task Re_declaring_updates_the_group_and_releases_a_dropped_round() => RunTestAsync(async service =>
    {
        // The group as first authored
        var first = await service.DeclareAsync(Manifest("mc-elementary", "mc-advanced"));

        // The same slug with one round taken out and a longer clock
        var second = await service.DeclareAsync(Manifest("mc-advanced") with { ClockMinutes = 240 });

        // The same group, updated rather than replaced
        Assert.Equal(first.GroupId, second.GroupId);
        Assert.False(second.Created);

        // Only one group stands under the slug
        Assert.Equal(1, await QueryValueAsync(context => context.HostedGroups.CountAsync()));

        // The clock the corrected manifest set
        Assert.Equal(
            240,
            await QueryValueAsync(context => context.HostedGroups
                .Where(group => group.Id == first.GroupId)
                .Select(group => group.ClockMinutes)
                .FirstAsync()));

        // And the dropped round belongs to nothing again
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId == first.GroupId)));
    });

    /// <summary>
    /// Verifies that a dry run answers what the real one would and writes nothing, which is what makes it worth
    /// running before a group is declared for real.
    /// </summary>
    [Fact]
    public Task A_dry_run_reports_what_it_would_do_and_writes_nothing() => RunTestAsync(async service =>
    {
        // The same manifest, run without writing
        var outcome = await service.DeclareAsync(Manifest("mc-elementary", "mc-advanced"), dryRun: true);

        // Answered as the real run would answer it
        Assert.True(outcome.Created);
        Assert.Equal(2, outcome.RoundsLinked);
        Assert.Equal(2, outcome.ProblemCount);

        // With no group standing behind that answer
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));

        // And no round claiming membership of one
        Assert.Equal(
            0,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId != null)));
    });

    /// <summary>
    /// Verifies that a dry run refuses a manifest the real declaration refuses, so a clean dry run is worth
    /// something.
    /// </summary>
    [Fact]
    public Task A_dry_run_refuses_a_manifest_the_declaration_would() => RunTestAsync(async service =>
        // A round nothing has been imported into
        await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary", "mc-intermediate"), dryRun: true)));

    /// <summary>
    /// Verifies that a round whose draft has not landed stops the declaration. A group standing with a category
    /// missing and nothing saying so is the failure this refusal exists for.
    /// </summary>
    [Fact]
    public Task A_manifest_naming_a_round_that_is_not_there_is_refused() => RunTestAsync(async service =>
    {
        // A category nothing has been imported into
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary", "mc-intermediate")));

        // Said in terms of the draft that has to land first
        Assert.Contains("mc-intermediate", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a round outside the hosted part of the taxonomy is refused, so a group cannot claim rounds
    /// of somebody else's competition.
    /// </summary>
    [Fact]
    public Task A_round_outside_the_hosted_root_is_refused() => RunTestAsync(async service =>
        // An archive round, which no group runs
        await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("csmo-a-i"))));

    /// <summary>
    /// Verifies that a round whose embargo disagrees with the group's closing instant is refused. The embargo is
    /// what actually holds the problems back, so a group promising a date its rounds do not keep would publish
    /// them early or late with nothing saying so.
    /// </summary>
    [Fact]
    public Task A_round_whose_embargo_disagrees_is_refused() => RunTestAsync(async service =>
    {
        // A manifest closing an hour after its rounds' problems come out
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced") with { ClosesAt = _closesAt.AddHours(1) }));

        // Said in terms of the field the author has to fix
        Assert.Contains("visibleSince", exception.Message, StringComparison.Ordinal);
    });

    /// <summary>
    /// Verifies that a group which never closes may hold a round that stays embargoed. Its problems are a
    /// rehearsal rather than archive material, and with no closing date there is none for an embargo to
    /// disagree with.
    /// </summary>
    [Fact]
    public Task A_group_that_never_closes_may_keep_its_problems_back() => RunTestAsync(async service =>
    {
        // A manifest naming no closing date, over a round whose problems are still held back
        var outcome = await service.DeclareAsync(Manifest("mc-advanced") with { ClosesAt = null });

        // The round is linked rather than refused
        Assert.Equal(1, outcome.RoundsLinked);

        // The embargo the round carries
        var visibleSince = await QueryValueAsync(context => context.Rounds
            .Where(round => round.Competition.Path == "mc-advanced")
            .Select(round => round.VisibleSince)
            .SingleAsync());

        // Left where the draft put it, the declaration having no closing date to hold it to
        Assert.Equal(_closesAt, visibleSince);
    });

    /// <summary>
    /// Verifies that rounds holding different numbers of problems are refused: the levels are one competition run
    /// at several difficulties, so picking a harder one must not also mean a longer paper.
    /// </summary>
    [Fact]
    public Task Rounds_of_different_sizes_are_refused() => RunTestAsync(async service =>
        // One round holds three problems where the other holds two
        await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced", "mc"))));

    /// <summary>
    /// Verifies that a round whose problems carry a statement in every language but no solution is refused.
    /// </summary>
    [Fact]
    public Task A_round_whose_problems_lack_a_solution_is_refused() => RunTestAsync(async service =>
    {
        // The round whose problems carry statements and no solutions
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-unsolved")));

        // Said in terms of the problems the author has to finish
        Assert.Contains("mc-unsolved", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that rounds holding nothing are refused. They hold equal numbers of problems, which is all
    /// <see cref="Rounds_of_different_sizes_are_refused"/> asks of them, so without this a group setting nothing
    /// at all reads as a competition.
    /// </summary>
    [Fact]
    public Task Rounds_holding_no_problems_are_refused() => RunTestAsync(async service =>
        // A round the draft placed with no problems under it
        await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-empty"))));

    /// <summary>
    /// Verifies that a group students have entered will not have its terms moved under them. A clock is read off
    /// the group, so shortening it expires an entry already running, and a moved window shuts a competition
    /// somebody is sitting.
    /// </summary>
    [Fact]
    public Task An_entered_groups_terms_can_no_longer_be_changed() => RunTestAsync(async service =>
    {
        // The group as declared
        var declared = await service.DeclareAsync(Manifest("mc-advanced"));

        // One student's entry into the group
        await SeedEntryAsync(declared.GroupId);

        // The same manifest with a shorter clock
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced") with { ClockMinutes = 30 }));

        // Said in terms of the group it is too late for
        Assert.Contains("mc-2026-3", exception.Message, StringComparison.Ordinal);

        // And the clock the student is sitting still stands
        Assert.Equal(
            180,
            await QueryValueAsync(context => context.HostedGroups
                .Where(group => group.Id == declared.GroupId)
                .Select(group => group.ClockMinutes)
                .FirstAsync()));
    });

    /// <summary>
    /// Verifies that re-running an unchanged manifest over an entered group is still allowed, which is what keeps
    /// <see cref="An_entered_groups_terms_can_no_longer_be_changed"/> about moving the terms rather than about
    /// touching the group at all.
    /// </summary>
    [Fact]
    public Task An_entered_group_may_be_declared_again_on_the_same_terms() => RunTestAsync(async service =>
    {
        // The group as declared
        var declared = await service.DeclareAsync(Manifest("mc-advanced"));

        // One student's entry into the group
        await SeedEntryAsync(declared.GroupId);

        // The same manifest again
        var again = await service.DeclareAsync(Manifest("mc-advanced"));

        // Which lands on the group already there
        Assert.Equal(declared.GroupId, again.GroupId);
        Assert.False(again.Created);
    });

    /// <summary>
    /// Verifies that a round somebody has entered cannot be dropped. Releasing it closes its problems to
    /// everybody, both the area and the defense engine requiring a hosted round, so the student loses what they
    /// paid for.
    /// </summary>
    [Fact]
    public Task A_round_students_have_entered_cannot_be_dropped() => RunTestAsync(async service =>
    {
        // The group as declared, running two rounds
        var declared = await service.DeclareAsync(Manifest("mc-elementary", "mc-advanced"));

        // One student's entry into the group's last round, which is mc-advanced
        await SeedEntryAsync(declared.GroupId);

        // A corrected manifest without it
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary")));

        // Said in terms of the round it would strand
        Assert.Contains("mc-advanced", exception.Message, StringComparison.Ordinal);

        // And the group still runs both
        Assert.Equal(
            2,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId == declared.GroupId)));
    });

    /// <summary>
    /// Verifies that a round another group already runs is refused. The lookup finds a round by its node and its
    /// season, neither of which says who runs it, so without this a second manifest naming the same round would
    /// take it, and the clocks running against the group it left would be read off the group it landed in.
    /// </summary>
    [Fact]
    public Task A_round_another_group_already_runs_is_refused() => RunTestAsync(async service =>
    {
        // The group that has the round
        await service.DeclareAsync(Manifest("mc-advanced"));

        // A second manifest reaching for the same one
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced") with { Slug = "mc-2026-3-fixed" }));

        // Said in terms of the round that is not going anywhere
        Assert.Contains("mc-advanced", exception.Message, StringComparison.Ordinal);

        // And only the group that declared it stands
        Assert.Equal(1, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a manifest the group cannot run on is refused as a manifest fault, whether a field it needs
    /// is absent or the window it names cannot be met. A field the YAML never named reads back as a blank rather
    /// than as a complaint, so nothing but these checks tells an author which line to fix.
    /// </summary>
    /// <param name="field">The fault the manifest carries, which is also what the refusal has to name.</param>
    [Theory]
    [InlineData("slug")]
    [InlineData("opensAt")]
    [InlineData("clock")]
    [InlineData("rounds")]
    [InlineData("competitionPath")]
    [InlineData("before it opens")]
    public Task A_manifest_missing_a_field_is_refused(string field) => RunTestAsync(async service =>
    {
        // The manifest as the reader would hand it over with that line absent
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Without(field)));

        // Named in terms of what is missing
        Assert.Contains(field, exception.Message, StringComparison.OrdinalIgnoreCase);
    });

    /// <summary>
    /// The manifest with one field blanked the way a reader blanks one the YAML never named.
    /// </summary>
    /// <param name="field">Which field to leave out.</param>
    /// <returns>The manifest, short of it.</returns>
    private static HostedGroupManifest Without(string field)
    {
        // The manifest every case starts from.
        var manifest = Manifest("mc-advanced");

        // Blanked the way the reader leaves an unnamed field, which for the closing instant means one that
        // cannot be met rather than one that is absent.
        return field switch
        {
            "slug" => manifest with { Slug = null! },
            "opensAt" => manifest with { OpensAt = default },
            "clock" => manifest with { ClockMinutes = 0 },
            "rounds" => manifest with { Rounds = null! },
            "competitionPath" => manifest with { Rounds = [new HostedGroupRoundRef(null!, SeasonYear)] },
            "before it opens" => manifest with { ClosesAt = _closesAt.AddYears(-5) },
            _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unknown manifest field."),
        };
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The season every round below sits in.
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = SeasonYear,
            EditionNumber = Season.EditionFromStartYear(SeasonYear),
        };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off, and an archive one to test the boundary with.
        CompetitionTreeSeed.Root(context, "mc", 100);
        CompetitionTreeSeed.Root(context, "csmo", 101);

        // Two rounds of the same size, embargoed to the instant the manifest closes at.
        SeedRound(context, season, "mc-elementary", _closesAt, problems: 2);
        SeedRound(context, season, "mc-advanced", _closesAt, problems: 2);

        // A round of a different size, for the disagreement the declaration has to catch.
        SeedRound(context, season, "mc", _closesAt, problems: 3);

        // A round whose problems were never given solutions, so it is not ready to be argued.
        SeedRound(context, season, "mc-unsolved", _closesAt, problems: 2, withSolutions: false);

        // A round the draft placed with no problems under it.
        SeedRound(context, season, "mc-empty", _closesAt, problems: 0);

        // An archive round, which no group may claim.
        SeedRound(context, season, "csmo-a-i", visibleSince: null, problems: 2);

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// The manifest under test, naming whichever rounds a case needs.
    /// </summary>
    /// <param name="competitionPaths">The nodes its rounds hang off.</param>
    /// <returns>The manifest.</returns>
    private static HostedGroupManifest Manifest(params string[] competitionPaths) =>
        new(
            "mc-2026-3",
            _closesAt.AddDays(-30),
            _closesAt,
            ClockMinutes: 180,
            AllowsReentry: false,
            [.. competitionPaths.Select(path => new HostedGroupRoundRef(path, SeasonYear))]);

    /// <summary>
    /// Spends one student's entry into one of a group's rounds, which is what makes its terms no longer the
    /// manifest's to move.
    /// </summary>
    /// <param name="groupId">The group whose last round is entered.</param>
    private Task SeedEntryAsync(Guid groupId) => QueryAsync(async context =>
    {
        // The student holding the entry, under a name short enough for its column and unique enough for two
        // students to coexist.
        var userId = Guid.CreateVersion7();
        var name = $"s{userId:N}"[..12];

        // The student row.
        context.Users.Add(new User { Id = userId, ExternalId = $"ext-{userId:N}", Username = name });

        // The last of the group's rounds, which the seeded ids make mc-advanced wherever a case names two.
        var roundId = await context.Rounds
            .Where(round => round.HostedGroupId == groupId)
            .OrderBy(round => round.Id)
            .Select(round => round.Id)
            .LastAsync();

        // The entry itself.
        context.HostedEntries.Add(new HostedEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            RoundId = roundId,
            StartedAt = DateTimeOffset.UtcNow,
        });

        // Submit changes
        await context.SaveChangesAsync();
    });

    /// <summary>
    /// Tracks one round with the problems it holds.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="competitionPath">The node the round hangs off.</param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    /// <param name="problems">How many problems the round holds.</param>
    /// <param name="withSolutions">
    /// Whether its problems carry a solution as well as a statement in every language, which is what a group
    /// needs of them. False leaves the solutions out, for the case about a round that is not ready.
    /// </param>
    private static void SeedRound(
        MathCompsDbContext context, Season season, string competitionPath, DateTimeOffset? visibleSince,
        int problems, bool withSolutions = true)
    {
        // The round itself, under the deepest node its path names.
        var roundId = Guid.CreateVersion7();
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = visibleSince,
        });

        // Its problems, given solutions as well as statements unless a case is about a round short of them.
        for (var number = 1; number <= problems; number += 1)
        {
            // The problem row.
            var problem = new Problem
            {
                Id = Guid.CreateVersion7(),
                RoundId = roundId,
                Number = number,
                Slug = $"{competitionPath}-{number}",
            };
            context.Problems.Add(problem);

            // What a group needs of a problem: a statement to serve, and a solution for the examiner to argue
            // against. A round a case wants short of that keeps only its statements.
            var documentTypes = withSolutions
                ? new[] { DocumentType.Statement, DocumentType.Solution }
                : [DocumentType.Statement];

            // Written in every language the site is read in, which is what the declaration counts.
            foreach (var language in Enum.GetValues<Language>())
            {
                // One row per kind, in that language.
                foreach (var documentType in documentTypes)
                {
                    // The text itself, named after what it is so a wrong one reads as wrong.
                    context.ProblemTexts.Add(new ProblemText
                    {
                        Id = Guid.NewGuid(),
                        ProblemId = problem.Id,
                        DocumentType = documentType,
                        Language = language,
                        MarkdownText = $"{documentType} {number} in {language}",
                        IsOriginal = language == Language.SK,
                        DateModified = DateTime.UtcNow,
                    });
                }
            }
        }
    }
}
