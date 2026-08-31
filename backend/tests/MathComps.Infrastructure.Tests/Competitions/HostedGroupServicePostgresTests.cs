using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
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
    /// How many problems the manifests announce, and how many each filled round is seeded with.
    /// </summary>
    private const int ProblemCount = 2;

    /// <summary>
    /// When the group closes, which is also when its problems come out.
    /// </summary>
    private static readonly DateTimeOffset _closesAt =
        new(2026, 10, 31, 22, 0, 0, TimeSpan.Zero);

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // What raises a node and a season the manifest names and the database has not met yet.
        services.AddCompetitionTreeWriter();

        // The service under test.
        services.AddScoped<IHostedGroupService, HostedGroupService>();
    }

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
            Manifest("mc-advanced-1") with { OpensAt = opensAt, ClosesAt = closesAt });

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
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1"));

        // Which put the group there
        Assert.True(outcome.Created);

        // Running both rounds
        Assert.Equal(2, outcome.RoundsLinked);

        // Both already full, so the group waits on nothing
        Assert.Equal(0, outcome.RoundsAwaitingProblems);

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
        var first = await service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1"));

        // The same slug with one round taken out and a longer clock
        var second = await service.DeclareAsync(Manifest("mc-advanced-1") with { ClockMinutes = 240 });

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
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1"), dryRun: true);

        // Answered as the real run would answer it
        Assert.True(outcome.Created);
        Assert.Equal(2, outcome.RoundsLinked);
        Assert.Equal(0, outcome.RoundsAwaitingProblems);

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
        // A node the registry gives competitions below it, which no run may put a round on
        await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary-1", "mc-intermediate"), dryRun: true)));

    /// <summary>
    /// Verifies that a manifest naming a node the registry gives competitions below it is refused. Such a node is
    /// where a group's categories hang, not a sitting anything runs, and the tool now raises whatever a manifest
    /// names — so without this it would put a round on the container itself.
    /// </summary>
    [Fact]
    public Task A_node_carrying_competitions_below_it_is_refused() => RunTestAsync(async service =>
    {
        // A category, registered and named everywhere, with the group's own sittings below it
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary-1", "mc-intermediate")));

        // Pointed at the competitions below it rather than at a registration to go and write, which is the one
        // gap of the three that is not the author's to fix in a file
        Assert.Contains("mc-intermediate", exception.Message, StringComparison.Ordinal);
        Assert.Contains("nested below it", exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("metadata.shared.json", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a round outside the hosted part of the taxonomy is refused, so a group cannot claim rounds
    /// of somebody else's competition.
    /// </summary>
    [Fact]
    public Task A_round_outside_the_hosted_root_is_refused() => RunTestAsync(async service =>
    {
        // An archive round, which no group runs
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("csmo-a-i")));

        // Named as the refusal it is. The seeded archive round carries no embargo either, so the check on that
        // would throw over the same manifest, and the type alone cannot tell the two apart
        Assert.Contains("is not under", exception.Message, StringComparison.Ordinal);
    });

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
            () => service.DeclareAsync(Manifest("mc-advanced-1") with { ClosesAt = _closesAt.AddHours(1) }));

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
        var outcome = await service.DeclareAsync(Manifest("mc-advanced-1") with { ClosesAt = null });

        // The round is linked rather than refused
        Assert.Equal(1, outcome.RoundsLinked);

        // The embargo the round carries
        var visibleSince = await QueryValueAsync(context => context.Rounds
            .Where(round => round.Competition.Path == "mc-advanced-1")
            .Select(round => round.VisibleSince)
            .SingleAsync());

        // Left where the draft put it, the declaration having no closing date to hold it to
        Assert.Equal(_closesAt, visibleSince);
    });

    /// <summary>
    /// Verifies that a round holding a different number of problems than the group announces is refused. The card
    /// promises the announced number to everybody who reads it, and a draft that landed short would have a student
    /// spend their one entry on a paper nobody finished writing.
    /// </summary>
    [Fact]
    public Task A_round_of_the_wrong_size_is_refused() => RunTestAsync(async service =>
    {
        // One round holds three problems where the manifest announces two
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced-1", "mc-intermediate-1")));

        // Said in terms of both numbers, so the author knows which side to fix
        Assert.Contains("holds 3 problem(s)", exception.Message, StringComparison.Ordinal);
        Assert.Contains("announces 2", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a round whose problems carry a statement in every language but no solution is refused.
    /// </summary>
    [Fact]
    public Task A_round_whose_problems_lack_a_solution_is_refused() => RunTestAsync(async service =>
    {
        // The round whose problems carry statements and no solutions
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary-2")));

        // Said in terms of the problems the author has to finish. The size refusal names the path too, so the
        // path alone would not tell which check fired
        Assert.Contains("mc-elementary-2", exception.Message, StringComparison.Ordinal);
        Assert.Contains("lack a statement", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a manifest naming a round nothing has raised yet creates it, along with the node it hangs
    /// off. This is what announcing a month ahead of its problems is: the taxonomy registers the node, and the
    /// one run puts the competition on the site with its dates, its clock and its size.
    /// </summary>
    [Fact]
    public Task A_manifest_raises_a_round_that_is_not_there_yet() => RunTestAsync(async service =>
    {
        // A node November's registration carries and no draft has ever raised
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-3"));

        // Which the declaration put there, running one round
        Assert.True(outcome.Created);
        Assert.Equal(1, outcome.RoundsLinked);

        // Empty, so the whole group is still waiting on its problems
        Assert.Equal(1, outcome.RoundsAwaitingProblems);

        // The node itself now stands
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.Competitions
                .CountAsync(node => node.Path == "mc-elementary-3")));

        // And the round hangs off it, embargoed until the group closes
        Assert.Equal(
            _closesAt,
            await QueryValueAsync(context => context.Rounds
                .Where(round => round.HostedGroupId == outcome.GroupId)
                .Select(round => round.VisibleSince)
                .SingleAsync()));
    });

    /// <summary>
    /// Verifies that a group which never closes may raise a round of its own. It is the practice group's shape,
    /// and the only one where the manifest has no closing instant to embargo a new round to, so the round is held
    /// back by an instant that never arrives instead.
    /// </summary>
    [Fact]
    public Task A_group_that_never_closes_may_raise_a_round() => RunTestAsync(async service =>
    {
        // A node nothing has raised yet, under a manifest naming no closing date
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-3") with { ClosesAt = null });

        // Which the declaration put there
        Assert.Equal(1, outcome.RoundsLinked);

        // Embargoed past anything a reader will live to see, which is what keeps its problems out of the archive
        var visibleSince = await QueryValueAsync(context => context.Rounds
            .Where(round => round.HostedGroupId == outcome.GroupId)
            .Select(round => round.VisibleSince)
            .SingleAsync());

        Assert.True(visibleSince > DateTimeOffset.UtcNow.AddYears(1000));
    });

    /// <summary>
    /// Verifies that a round is dated the day the competition opens where its author sits, not the day that
    /// instant falls on in UTC. A window opening at local midnight is the previous evening in UTC, so reading
    /// the date off the stored instant would put every round on the site a day before it runs.
    /// </summary>
    [Fact]
    public Task A_round_is_dated_the_day_it_opens_where_it_is_written() => RunTestAsync(async service =>
    {
        // Midnight on the 16th in central Europe, which is the 15th at 23:00 UTC
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-3") with
        {
            OpensAt = new DateTimeOffset(2026, 11, 16, 0, 0, 0, TimeSpan.FromHours(1)),
            ClosesAt = new DateTimeOffset(2026, 11, 30, 23, 59, 59, TimeSpan.FromHours(1)),
        });

        // The day it opens on, not the day the instant lands on in UTC
        Assert.Equal(
            new DateOnly(2026, 11, 16),
            await QueryValueAsync(context => context.Rounds
                .Where(round => round.HostedGroupId == outcome.GroupId)
                .Select(round => round.Date)
                .SingleAsync()));
    });

    /// <summary>
    /// Verifies that a group announced ahead of its problems may still have its window moved. The round carries
    /// the embargo this tool wrote for it and no draft owns it yet, so the dates go on being the manifest's to
    /// correct — without that the window would freeze the moment the group went on the site.
    /// </summary>
    [Fact]
    public Task An_announced_groups_window_may_still_move() => RunTestAsync(async service =>
    {
        // Announced on one window
        await service.DeclareAsync(Manifest("mc-elementary-3"));

        // And corrected onto another, a day later at both ends
        var moved = Manifest("mc-elementary-3") with
        {
            OpensAt = _closesAt.AddDays(-29),
            ClosesAt = _closesAt.AddDays(1),
        };
        var outcome = await service.DeclareAsync(moved);

        // Which the round it raised follows, rather than refusing over the embargo it wrote itself
        var round = await QueryValueAsync(context => context.Rounds
            .Where(candidate => candidate.HostedGroupId == outcome.GroupId)
            .Select(candidate => new { candidate.Date, candidate.VisibleSince })
            .SingleAsync());

        Assert.Equal(moved.ClosesAt, round.VisibleSince);
        Assert.Equal(DateOnly.FromDateTime(moved.OpensAt.DateTime), round.Date);
    });

    /// <summary>
    /// Verifies that a round holding problems keeps the embargo its draft gave it. From the moment a draft lands
    /// it owns that instant, and the problems really are held back by it, so a manifest promising a different
    /// closing date is promising one the problems would not keep.
    /// </summary>
    [Fact]
    public Task A_filled_rounds_embargo_still_holds_the_manifest_to_it() => RunTestAsync(async service =>
    {
        // A round a draft filled, under a manifest closing an hour off its embargo
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1") with
            {
                ClosesAt = _closesAt.AddHours(1),
            }));

        // Said in terms of the draft that has to be corrected
        Assert.Contains("visibleSince", exception.Message, StringComparison.Ordinal);
    });

    /// <summary>
    /// Verifies that a dry run over a round nothing has raised yet leaves the database as it found it. Raising a
    /// node saves each generation before descending into the next, so those rows land long before the save the
    /// dry run skips: only the transaction takes them back out again.
    /// </summary>
    [Fact]
    public Task A_dry_run_raising_a_round_writes_nothing() => RunTestAsync(async service =>
    {
        // A node no draft has ever raised, run without writing
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-3"), dryRun: true);

        // Which the run reports it would have created
        Assert.True(outcome.Created);
        Assert.Equal(1, outcome.RoundsLinked);

        // And the node the walk saved on its way down is gone again
        Assert.Equal(
            0,
            await QueryValueAsync(context => context.Competitions
                .CountAsync(node => node.Path == "mc-elementary-3")));

        // As is the group, and the round it would have run
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
        Assert.Equal(
            0,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.Competition.Path == "mc-elementary-3")));
    });

    /// <summary>
    /// Verifies that a round in a season the database has not met yet raises the season too. A group is announced
    /// the day its dates are decided, so the first manifest of a school year arrives before anything else in it.
    /// </summary>
    [Fact]
    public Task A_manifest_raises_a_season_that_is_not_there_yet() => RunTestAsync(async service =>
    {
        // The same node, a year on from every season the seed placed
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-3") with
        {
            Rounds = [new HostedGroupRoundRef("mc-elementary-3", SeasonYear + 1)],
        });

        // The season now stands
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.Seasons
                .CountAsync(season => season.StartYear == SeasonYear + 1)));

        // And the round the group runs sits in it rather than in the one the seed placed
        Assert.Equal(
            SeasonYear + 1,
            await QueryValueAsync(context => context.Rounds
                .Where(round => round.HostedGroupId == outcome.GroupId)
                .Select(round => round.Season.StartYear)
                .SingleAsync()));
    });

    /// <summary>
    /// Verifies that a path the taxonomy does not register is refused, since a node the registry cannot place has
    /// no slot among its siblings. Registering one is a code change, so this is the author's to fix before the
    /// tool can do anything at all with it.
    /// </summary>
    [Fact]
    public Task A_path_the_registry_does_not_carry_is_refused() => RunTestAsync(async service =>
    {
        // Under the hosted root, so it clears the manifest's own checks, and registered nowhere
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-nonesuch")));

        // Said in terms of the file the author has to add it to
        Assert.Contains("metadata.shared.json", exception.Message, StringComparison.Ordinal);

        // And nothing was written, the node included
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
        Assert.Equal(
            0,
            await QueryValueAsync(context => context.Competitions
                .CountAsync(node => node.Path == "mc-nonesuch")));
    });

    /// <summary>
    /// Verifies that a round whose draft landed short of the announced size is refused. This is the direction
    /// announcing ahead actually produces: the empty round is fine and the full one is fine, and the way a real
    /// month goes wrong is a draft that lands three of the four problems it promised.
    /// </summary>
    [Fact]
    public Task A_round_that_landed_short_is_refused() => RunTestAsync(async service =>
    {
        // One problem where the manifest announces two
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced-2")));

        // Said in terms of both numbers
        Assert.Contains("holds 1 problem(s)", exception.Message, StringComparison.Ordinal);
        Assert.Contains("announces 2", exception.Message, StringComparison.Ordinal);

        // And nothing was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedGroups.CountAsync()));
    });

    /// <summary>
    /// Verifies that a group stands over a round holding nothing, which is what announcing one ahead of its
    /// problems looks like. The dates, the clock and the size go on the site the moment they are decided; the
    /// problems land later, and <see cref="A_round_of_the_wrong_size_is_refused"/> is what catches a draft that
    /// lands short of what was announced.
    /// </summary>
    [Fact]
    public Task A_group_stands_before_its_problems_land() => RunTestAsync(async service =>
    {
        // A round the draft placed with no problems under it
        var outcome = await service.DeclareAsync(Manifest("mc-intermediate-2"));

        // Which put the group there anyway
        Assert.True(outcome.Created);

        // Announcing the size the manifest names rather than the nothing the round holds
        Assert.Equal(ProblemCount, outcome.ProblemCount);

        // And saying the round is still to be filled
        Assert.Equal(1, outcome.RoundsAwaitingProblems);

        // The group carries the announced size, which is what the card reads
        Assert.Equal(
            ProblemCount,
            await QueryValueAsync(context => context.HostedGroups
                .Where(group => group.Id == outcome.GroupId)
                .Select(group => group.ProblemCount)
                .SingleAsync()));
    });

    /// <summary>
    /// Verifies that a group runs a filled round beside ones still waiting, and counts every one it waits on.
    /// This is the state a real month spends most of its time in, since the drafts land one category at a time,
    /// and the count is what tells the author how much of the month is still to come.
    /// </summary>
    [Fact]
    public Task A_group_may_run_a_filled_round_beside_empty_ones() => RunTestAsync(async service =>
    {
        // One category authored, two still to come
        var outcome = await service.DeclareAsync(Manifest("mc-advanced-1", "mc-intermediate-2", "mc-intermediate-3"));

        // All three run in the group
        Assert.Equal(3, outcome.RoundsLinked);

        // And it waits on both of the empty ones, not merely on there being some
        Assert.Equal(2, outcome.RoundsAwaitingProblems);
    });

    /// <summary>
    /// Verifies that a dry run over a group that already stands leaves it alone. Every other field is written by
    /// assignment onto a tracked row, so nothing but the absent save keeps a dry run out of the database, and the
    /// create-path dry run cannot notice that: there is no row there to be spoiled.
    /// </summary>
    [Fact]
    public Task A_dry_run_over_a_standing_group_writes_nothing() => RunTestAsync(async service =>
    {
        // The group as it really stands
        var outcome = await service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1"));

        // A moved clock over a dropped round, run without writing
        await service.DeclareAsync(Manifest("mc-elementary-1") with { ClockMinutes = 240 }, dryRun: true);

        // The clock the group was declared with, which the dry run assigned over on the tracked row
        Assert.Equal(
            180,
            await QueryValueAsync(context => context.HostedGroups
                .Where(group => group.Id == outcome.GroupId)
                .Select(group => group.ClockMinutes)
                .SingleAsync()));

        // And the round the dry run's manifest dropped is still one the group runs
        Assert.Equal(
            2,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId == outcome.GroupId)));
    });

    /// <summary>
    /// Verifies that re-declaring a group nobody has entered may resize it. The size is the manifest's until an
    /// entry is spent on it, so correcting a month that was announced at the wrong number is one more run.
    /// </summary>
    [Fact]
    public Task An_unentered_groups_size_may_be_corrected() => RunTestAsync(async service =>
    {
        // Announced over a round still holding nothing
        var announced = await service.DeclareAsync(Manifest("mc-intermediate-2"));

        // Re-announced at a different size
        await service.DeclareAsync(Manifest("mc-intermediate-2") with { ProblemCount = 5 });

        // Which the group now carries
        Assert.Equal(
            5,
            await QueryValueAsync(context => context.HostedGroups
                .Where(group => group.Id == announced.GroupId)
                .Select(group => group.ProblemCount)
                .SingleAsync()));
    });

    /// <summary>
    /// Verifies that filling an announced round afterwards leaves the group exactly as it stood. This is the pair
    /// of runs a real month takes: declare it the day the dates are set, apply the drafts once the problems are
    /// picked, declare again to check they match.
    /// </summary>
    [Fact]
    public Task Re_declaring_once_the_problems_land_changes_nothing() => RunTestAsync(async service =>
    {
        // Announced while its round holds nothing
        var announced = await service.DeclareAsync(Manifest("mc-intermediate-2"));

        // The problems landing on it, the way applying its draft would
        await QueryAsync(async context =>
        {
            // The round that was announced empty
            var round = await context.Rounds
                .SingleAsync(candidate => candidate.Competition.Path == "mc-intermediate-2");

            // Filled to exactly what the group announced
            SeedProblems(context, round, "mc-intermediate-2", ProblemCount, withSolutions: true);
            await context.SaveChangesAsync();
        });

        // The same manifest run a second time
        var redeclared = await service.DeclareAsync(Manifest("mc-intermediate-2"));

        // Which updated the group it already put there rather than adding a second
        Assert.False(redeclared.Created);
        Assert.Equal(announced.GroupId, redeclared.GroupId);

        // And now has nothing left to wait for
        Assert.Equal(0, redeclared.RoundsAwaitingProblems);

        // The round the first run linked is still the one it runs, having been released and re-linked in between
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.Rounds
                .CountAsync(round => round.HostedGroupId == redeclared.GroupId)));
    });

    /// <summary>
    /// Verifies that a group students have entered will not have its terms moved under them. A clock is read off
    /// the group, so shortening it expires an entry already running, and a moved window shuts a competition
    /// somebody is sitting.
    /// </summary>
    [Fact]
    public Task An_entered_groups_terms_can_no_longer_be_changed() => RunTestAsync(async service =>
    {
        // The group as declared
        var declared = await service.DeclareAsync(Manifest("mc-advanced-1"));

        // One student's entry into the group
        await SeedEntryAsync(declared.GroupId);

        // The same manifest with a shorter clock
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced-1") with { ClockMinutes = 30 }));

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
        var declared = await service.DeclareAsync(Manifest("mc-advanced-1"));

        // One student's entry into the group
        await SeedEntryAsync(declared.GroupId);

        // The same manifest again
        var again = await service.DeclareAsync(Manifest("mc-advanced-1"));

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
        var declared = await service.DeclareAsync(Manifest("mc-elementary-1", "mc-advanced-1"));

        // One student's entry into the group's last round, which is mc-advanced
        await SeedEntryAsync(declared.GroupId);

        // A corrected manifest without it
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-elementary-1")));

        // Said in terms of the round it would strand
        Assert.Contains("mc-advanced-1", exception.Message, StringComparison.Ordinal);

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
        await service.DeclareAsync(Manifest("mc-advanced-1"));

        // A second manifest reaching for the same one
        var exception = await Assert.ThrowsAsync<HostedGroupManifestException>(
            () => service.DeclareAsync(Manifest("mc-advanced-1") with { Slug = "mc-2026-3-fixed" }));

        // Said in terms of the round that is not going anywhere
        Assert.Contains("mc-advanced-1", exception.Message, StringComparison.Ordinal);

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
    [InlineData("problems")]
    [InlineData("rounds")]
    [InlineData("competitionPath")]
    [InlineData("seasonYear")]
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
        var manifest = Manifest("mc-advanced-1");

        // Blanked the way the reader leaves an unnamed field, which for the closing instant means one that
        // cannot be met rather than one that is absent.
        return field switch
        {
            "slug" => manifest with { Slug = null! },
            "opensAt" => manifest with { OpensAt = default },
            "clock" => manifest with { ClockMinutes = 0 },
            "problems" => manifest with { ProblemCount = 0 },
            "rounds" => manifest with { Rounds = null! },
            "competitionPath" => manifest with { Rounds = [new HostedGroupRoundRef(null!, SeasonYear)] },
            "seasonYear" => manifest with { Rounds = [new HostedGroupRoundRef("mc-advanced-1", 0)] },
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
        SeedRound(context, season, "mc-elementary-1", _closesAt, problems: 2);
        SeedRound(context, season, "mc-advanced-1", _closesAt, problems: 2);

        // A round of a different size, for the disagreement the declaration has to catch.
        SeedRound(context, season, "mc-intermediate-1", _closesAt, problems: 3);

        // A round whose problems were never given solutions, so it is not ready to be argued.
        SeedRound(context, season, "mc-elementary-2", _closesAt, problems: 2, withSolutions: false);

        // A round the draft placed with no problems under it.
        SeedRound(context, season, "mc-intermediate-2", _closesAt, problems: 0);

        // A round whose draft landed one short of what a group announces.
        SeedRound(context, season, "mc-advanced-2", _closesAt, problems: ProblemCount - 1);

        // A second round nobody has authored yet, so a group can wait on more than one of them.
        SeedRound(context, season, "mc-intermediate-3", _closesAt, problems: 0);

        // An archive round, which no group may claim.
        SeedRound(context, season, "csmo-a-i", visibleSince: null, problems: 2);

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// The manifest under test, naming whichever rounds a case needs and announcing what the seeded rounds hold.
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
            ProblemCount,
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
    /// <param name="withSolutions"><inheritdoc cref="SeedProblems" path="/param[@name='withSolutions']"/></param>
    private static void SeedRound(
        MathCompsDbContext context, Season season, string competitionPath, DateTimeOffset? visibleSince,
        int problems, bool withSolutions = true)
    {
        // The round itself, under the deepest node its path names.
        var round = new Round
        {
            Id = Guid.CreateVersion7(),
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = visibleSince,
        };
        context.Rounds.Add(round);

        // What it holds, which for an announced-ahead round is nothing.
        SeedProblems(context, round, competitionPath, problems, withSolutions);
    }

    /// <summary>
    /// Tracks the problems one round holds, each written in every language the site is read in.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="round">The round they hang off.</param>
    /// <param name="competitionPath">The node the round hangs off, which is what names each problem's slug.</param>
    /// <param name="problems">How many to write.</param>
    /// <param name="withSolutions">
    /// Whether they carry a solution as well as a statement in every language, which is what a group needs of
    /// them. False leaves the solutions out, for the case about a round that is not ready.
    /// </param>
    private static void SeedProblems(
        MathCompsDbContext context, Round round, string competitionPath, int problems, bool withSolutions)
    {
        // Its problems, given solutions as well as statements unless a case is about a round short of them.
        for (var number = 1; number <= problems; number += 1)
        {
            // The problem row.
            var problem = new Problem
            {
                Id = Guid.CreateVersion7(),
                RoundId = round.Id,
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
