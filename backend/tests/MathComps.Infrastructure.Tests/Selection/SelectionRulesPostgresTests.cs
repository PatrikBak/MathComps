using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers the rule every selection write shares: it waits until no other selection write is running. Two writes
/// interleaving could both take one pool problem, a finalize and a swap leaving a round a problem short, which
/// breaks the competitions page for every reader and fails no other test.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class SelectionRulesPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProposalService>(fixture)
{
    /// <summary>
    /// A proposal in the pool.
    /// </summary>
    private Guid _proposalId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // A selection service to write through.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A write started while another holds the selection lands only once that one commits.
    /// </summary>
    [Fact]
    public Task A_write_waits_for_the_write_holding_the_selection() => RunTestAsync(async service =>
    {
        // A write still running, on a context of its own
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var running = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // The running write's transaction, held open
        await using var transaction = await running.Database.BeginTransactionAsync();

        // The running write holding the lock every selection write waits for
        await ProblemPositions.LockAsync(running, CancellationToken.None);

        // A second write, started meanwhile
        var write = service.SetAsideAsync(_proposalId, isSetAside: true);

        // A while later
        await Task.Delay(TimeSpan.FromMilliseconds(500));

        // The second write still waiting
        Assert.False(write.IsCompleted);

        // The running write commits
        await transaction.CommitAsync();

        // The second write goes through
        await write;

        // Having done what it was asked
        Assert.True(await QueryValueAsync(context => context.Proposals
            .Where(proposal => proposal.ProblemId == _proposalId)
            .Select(proposal => proposal.IsSetAside)
            .SingleAsync()));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, SelectionSeed.NewSeason(context));

        // The one proposal in the pool
        _proposalId = SelectionSeed.NewProposal(context, pool, 1, 1);

        // Written
        await context.SaveChangesAsync();
    }
}
