using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Integration tests for <see cref="ProblemSwapService"/> against a real Postgres database. These pin what only a
/// real database can show: that the rows keep their ids while their positions change, so everything hanging off a
/// problem follows it; that the non-deferrable unique index over (round, number) survives an exchange inside one
/// round; that a slug a third problem already carries is refused; and that a dry run leaves the database alone.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemSwapServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProblemSwapService>(fixture)
{
    /// <summary>
    /// The slug of the csmo problem sitting first in its round, and the one every dependent row hangs off.
    /// </summary>
    private const string CsmoFirstSlug = "74-csmo-a-iii-1";

    /// <summary>
    /// The slug of the csmo problem sitting third in its round.
    /// </summary>
    private const string CsmoThirdSlug = "74-csmo-a-iii-3";

    /// <summary>
    /// The slug of the imo problem sitting second in its round, which is in a different competition and season.
    /// </summary>
    private const string ImoSecondSlug = "75-imo-2";

    /// <summary>
    /// The slug of the memo problem sitting first in the round whose slugs have drifted from their positions.
    /// </summary>
    private const string MemoFirstSlug = "74-memo-i-1";

    /// <summary>
    /// The slug carried by the memo problem sitting second, which its position does not call for. A round in this
    /// state is the reason someone reaches for an exchange in the first place.
    /// </summary>
    private const string MemoDriftedSlug = "74-memo-i-drifted";

    /// <summary>
    /// The slug the memo round's third problem carries, which is the one its second position calls for. It is what
    /// makes an exchange between the first two problems collide.
    /// </summary>
    private const string MemoStraySlug = "74-memo-i-2";

    /// <summary>
    /// The csmo problem every dependent row hangs off, so the test can follow the id across the exchange.
    /// </summary>
    private readonly Guid _csmoFirstId = Guid.CreateVersion7();

    /// <summary>
    /// The csmo problem sitting third in the same round, the other half of the same-round exchange.
    /// </summary>
    private readonly Guid _csmoThirdId = Guid.CreateVersion7();

    /// <summary>
    /// The imo problem, the other half of the cross-round exchange.
    /// </summary>
    private readonly Guid _imoSecondId = Guid.CreateVersion7();

    /// <summary>
    /// The round the csmo problems sit in.
    /// </summary>
    private readonly Guid _csmoRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round the imo problem sits in.
    /// </summary>
    private readonly Guid _imoRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round whose slugs drifted off their positions.
    /// </summary>
    private readonly Guid _memoRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The memo problem sitting second, on a slug of its own.
    /// </summary>
    private readonly Guid _memoDriftedId = Guid.CreateVersion7();

    /// <summary>
    /// The memo problem sitting third, on the slug the second position calls for.
    /// </summary>
    private readonly Guid _memoStrayId = Guid.CreateVersion7();

    /// <summary>
    /// The student whose work hangs off the csmo problem.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// The conversation argued about the csmo problem, which must still name the same problem afterwards.
    /// </summary>
    private readonly Guid _defenseSessionId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The tested service.
        services.AddScoped<IProblemSwapService, ProblemSwapService>();

    /// <summary>
    /// Two problems in different competitions and seasons trade places: both keep their ids, each takes the other's
    /// position and the slug that position calls for, and the conversation argued about one of them still names the
    /// same problem.
    /// </summary>
    [Fact]
    public Task An_exchange_across_rounds_moves_the_rows_and_leaves_their_ids_alone() => RunTestAsync(async service =>
    {
        // Exchange the csmo problem with one sitting in another competition, in another season.
        var result = await service.SwapAsync(CsmoFirstSlug, ImoSecondSlug);

        // The report names where each stood and how much of the student's work hangs off the csmo one.
        Assert.Equal("csmo-a-iii", result.First.CompetitionPath);
        Assert.Equal(2024, result.First.SeasonYear);
        Assert.Equal(1, result.First.Number);
        Assert.Equal(1, result.First.Defenses);
        Assert.Equal(2, result.First.Comments);
        Assert.Equal(3, result.First.SelfAssessments);

        // Each takes the slug its destination position calls for.
        Assert.Equal(ImoSecondSlug, result.FirstNewSlug);
        Assert.Equal(CsmoFirstSlug, result.SecondNewSlug);

        // Read the rows back as they were committed.
        await QueryAsync(async context =>
        {
            // The csmo problem kept its id and now sits second in the imo round, under the imo slug.
            var moved = await context.Problems.SingleAsync(problem => problem.Id == _csmoFirstId);
            Assert.Equal(_imoRoundId, moved.RoundId);
            Assert.Equal(2, moved.Number);
            Assert.Equal(ImoSecondSlug, moved.Slug);

            // The imo problem kept its id and now sits first in the csmo round, under the csmo slug.
            var arrived = await context.Problems.SingleAsync(problem => problem.Id == _imoSecondId);
            Assert.Equal(_csmoRoundId, arrived.RoundId);
            Assert.Equal(1, arrived.Number);
            Assert.Equal(CsmoFirstSlug, arrived.Slug);

            // The conversation still names the problem it was argued about, which has moved with its id.
            var defense = await context.ProblemDefenses
                .SingleAsync(row => row.DefenseSessionId == _defenseSessionId);
            Assert.Equal(_csmoFirstId, defense.ProblemId);

            // No round ended up with two problems on one number.
            await AssertNumbersAreUniqueAsync(context);
        });
    });

    /// <summary>
    /// Two problems of the same round trade places. The unique index over (round, number) is checked per statement,
    /// so this is the exchange that fails outright if the rows are asked to trade numbers directly.
    /// </summary>
    [Fact]
    public Task An_exchange_within_one_round_reorders_it() => RunTestAsync(async service =>
    {
        // Exchange the first and third problems of the csmo round.
        await service.SwapAsync(CsmoFirstSlug, CsmoThirdSlug);

        // Read the round back.
        await QueryAsync(async context =>
        {
            // The first problem now sits third, under the slug that position calls for.
            var moved = await context.Problems.SingleAsync(problem => problem.Id == _csmoFirstId);
            Assert.Equal(_csmoRoundId, moved.RoundId);
            Assert.Equal(3, moved.Number);
            Assert.Equal(CsmoThirdSlug, moved.Slug);

            // The third problem now sits first, likewise.
            var arrived = await context.Problems.SingleAsync(problem => problem.Id == _csmoThirdId);
            Assert.Equal(_csmoRoundId, arrived.RoundId);
            Assert.Equal(1, arrived.Number);
            Assert.Equal(CsmoFirstSlug, arrived.Slug);

            // No round ended up with two problems on one number.
            await AssertNumbersAreUniqueAsync(context);
        });
    });

    /// <summary>
    /// An exchange whose destination slug a third problem already carries is refused, and nothing is written. The
    /// schema does not enforce slug uniqueness, so nothing downstream would catch it until the next import of
    /// either problem resolved the slug to two rows.
    /// </summary>
    [Fact]
    public Task A_slug_a_third_problem_carries_is_refused() => RunTestAsync(async service =>
    {
        // The memo round's second position calls for a slug its third problem is already sitting on.
        await Assert.ThrowsAsync<ProblemSwapRefusedException>(
            () => service.SwapAsync(MemoFirstSlug, MemoDriftedSlug));

        // The memo round is exactly as it was seeded.
        await QueryAsync(async context =>
        {
            // Every memo problem still carries the slug and the number it was seeded with.
            Assert.Equal(1, await NumberOfAsync(context, MemoFirstSlug));
            Assert.Equal(2, await NumberOfAsync(context, MemoDriftedSlug));
            Assert.Equal(3, await NumberOfAsync(context, MemoStraySlug));
        });
    });

    /// <summary>
    /// A slug two problems answer to is refused. The schema does not make a slug unique, so this is a state the
    /// database can really be in, and the one an exchange is reached for.
    /// </summary>
    /// <remarks>
    /// The pair exchanged here has free destination slugs and the duplicate sits on neither of them, so the lookup
    /// is the only thing that can refuse it. A pair whose slugs collide would be refused by the collision check,
    /// which would pass with no duplicate handling at all.
    /// </remarks>
    [Fact]
    public Task A_slug_more_than_one_problem_carries_is_refused() => RunTestAsync(async service =>
    {
        // Put a second problem on the slug the drifted memo problem carries.
        await QueryAsync(async context =>
        {
            // A row of another round answering to it, which makes the slug name two problems.
            context.Problems.Add(new Problem
            {
                Id = Guid.CreateVersion7(),
                RoundId = _imoRoundId,
                Number = 9,
                Slug = MemoDriftedSlug,
            });

            // Commit the duplicate.
            await context.SaveChangesAsync();
        });

        // Naming that slug is refused.
        await Assert.ThrowsAsync<ProblemSwapRefusedException>(
            () => service.SwapAsync(MemoDriftedSlug, MemoStraySlug));

        // Neither problem the exchange named moved.
        await QueryAsync(async context =>
        {
            // The drifted problem still sits second in the memo round.
            var drifted = await context.Problems.SingleAsync(problem => problem.Id == _memoDriftedId);
            Assert.Equal(_memoRoundId, drifted.RoundId);
            Assert.Equal(2, drifted.Number);

            // And the one it was to be exchanged with still sits third.
            var stray = await context.Problems.SingleAsync(problem => problem.Id == _memoStrayId);
            Assert.Equal(_memoRoundId, stray.RoundId);
            Assert.Equal(3, stray.Number);
        });
    });

    /// <summary>
    /// A dry run works the whole exchange out and writes none of it.
    /// </summary>
    [Fact]
    public Task A_dry_run_reports_the_exchange_and_writes_nothing() => RunTestAsync(async service =>
    {
        // Ask what exchanging the two problems would do.
        var result = await service.SwapAsync(CsmoFirstSlug, ImoSecondSlug, dryRun: true);

        // It names the slugs it would have written.
        Assert.Equal(ImoSecondSlug, result.FirstNewSlug);
        Assert.Equal(CsmoFirstSlug, result.SecondNewSlug);

        // And the database still holds both problems where they were.
        await QueryAsync(async context =>
        {
            // The csmo problem never left its round or its number.
            var first = await context.Problems.SingleAsync(problem => problem.Id == _csmoFirstId);
            Assert.Equal(_csmoRoundId, first.RoundId);
            Assert.Equal(1, first.Number);
            Assert.Equal(CsmoFirstSlug, first.Slug);

            // Nor did the imo problem.
            var second = await context.Problems.SingleAsync(problem => problem.Id == _imoSecondId);
            Assert.Equal(_imoRoundId, second.RoundId);
            Assert.Equal(2, second.Number);
            Assert.Equal(ImoSecondSlug, second.Slug);
        });
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The two seasons the rounds run in, each carrying its own ročník.
        var season2024 = new Season { Id = Guid.NewGuid(), StartYear = 2024, EditionNumber = 74 };
        var season2025 = new Season { Id = Guid.NewGuid(), StartYear = 2025, EditionNumber = 75 };
        context.Seasons.AddRange(season2024, season2025);

        // A three-problem national round, the one the same-round exchange reorders.
        context.Rounds.Add(new Round
        {
            Id = _csmoRoundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "csmo-a-iii").Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2024, 3, 15),
        });

        // Its problems, each on the slug its position calls for.
        context.Problems.AddRange(
            new Problem { Id = _csmoFirstId, RoundId = _csmoRoundId, Number = 1, Slug = CsmoFirstSlug },
            new Problem { Id = Guid.CreateVersion7(), RoundId = _csmoRoundId, Number = 2, Slug = "74-csmo-a-iii-2" },
            new Problem { Id = _csmoThirdId, RoundId = _csmoRoundId, Number = 3, Slug = CsmoThirdSlug });

        // A round of another competition in another season, so the cross-round exchange changes both halves of
        // every slug it writes.
        context.Rounds.Add(new Round
        {
            Id = _imoRoundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "imo").Id,
            SeasonId = season2025.Id,
            Date = new DateOnly(2025, 7, 10),
        });

        // Its problems.
        context.Problems.AddRange(
            new Problem { Id = Guid.CreateVersion7(), RoundId = _imoRoundId, Number = 1, Slug = "75-imo-1" },
            new Problem { Id = _imoSecondId, RoundId = _imoRoundId, Number = 2, Slug = ImoSecondSlug });

        // A round whose slugs drifted off their positions, which is the state that makes a destination slug
        // collide with a problem already carrying it.
        context.Rounds.Add(new Round
        {
            Id = _memoRoundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, "memo-i").Id,
            SeasonId = season2024.Id,
            Date = new DateOnly(2024, 8, 20),
        });

        // Its problems: the second sits on a slug of its own, and the third on the one the second position calls for.
        context.Problems.AddRange(
            new Problem { Id = Guid.CreateVersion7(), RoundId = _memoRoundId, Number = 1, Slug = MemoFirstSlug },
            new Problem { Id = _memoDriftedId, RoundId = _memoRoundId, Number = 2, Slug = MemoDriftedSlug },
            new Problem { Id = _memoStrayId, RoundId = _memoRoundId, Number = 3, Slug = MemoStraySlug });

        // The student whose work hangs off the csmo problem.
        context.Users.Add(new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" });

        // The conversation argued about it, which must still name the same problem after the exchange.
        context.DefenseSessions.Add(new DefenseSession
        {
            Id = _defenseSessionId,
            UserId = _studentId,
            TargetKind = DefenseTargetKind.Problem,
            ProblemStatement = "a problem",
            ProblemReference = "a reference",
            ExaminerConfig = "{}",
            CreatedAt = DateTimeOffset.UtcNow,
        });

        // The row tying that conversation to the problem.
        context.ProblemDefenses.Add(new ProblemDefense
        {
            DefenseSessionId = _defenseSessionId,
            ProblemId = _csmoFirstId,
        });

        // Two comments on the same problem, a different count from its defenses and its self-assessments so a
        // report that counted the wrong table could not read as right.
        foreach (var content in new[] { "first thought", "second thought" })
        {
            // The comment itself.
            var comment = new Comment { Id = Guid.CreateVersion7(), AuthorId = _studentId, Content = content };
            context.Comments.Add(comment);

            // And the row tying it to the problem.
            context.ProblemComments.Add(new ProblemComment { ProblemId = _csmoFirstId, CommentId = comment.Id });
        }

        // Three students' records of how they did on it, again a count of its own.
        foreach (var index in Enumerable.Range(1, 3))
        {
            // Each assessment needs its own student, since one student records one per problem.
            var assessor = new User { Id = Guid.CreateVersion7(), ExternalId = $"ext-assessor-{index}" };
            context.Users.Add(assessor);

            // What they made of the problem.
            context.ProblemSelfAssessments.Add(new ProblemSelfAssessment
            {
                UserId = assessor.Id,
                ProblemId = _csmoFirstId,
                Comment = $"assessment {index}",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Asserts that no round holds two problems on the same number, which is the invariant an exchange passing
    /// through a parking number is at risk of breaking.
    /// </summary>
    /// <param name="context">A context over the database the exchange committed to.</param>
    /// <returns>A task representing the assertion.</returns>
    private static async Task AssertNumbersAreUniqueAsync(MathCompsDbContext context)
    {
        // Every (round, number) pair that more than one problem sits on.
        var duplicates = await context.Problems
            .GroupBy(problem => new { problem.RoundId, problem.Number })
            .Where(group => group.Count() > 1)
            .CountAsync();

        // There must be none.
        Assert.Equal(0, duplicates);
    }

    /// <summary>
    /// Reads the number the problem carrying a slug sits on.
    /// </summary>
    /// <param name="context">A context over the database.</param>
    /// <param name="slug">The slug naming the problem.</param>
    /// <returns>The problem's number.</returns>
    private static Task<int> NumberOfAsync(MathCompsDbContext context, string slug) =>
        // The stored position of the one problem carrying that slug.
        context.Problems.Where(problem => problem.Slug == slug).Select(problem => problem.Number).SingleAsync();
}
