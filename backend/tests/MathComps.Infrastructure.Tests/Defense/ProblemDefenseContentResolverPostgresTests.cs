using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="ProblemDefenseContentResolver"/> against a real PostgreSQL database: which of a
/// problem's texts count as the statements it has now.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProblemDefenseContentResolverPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefenseContentResolver<ProblemTarget>>(fixture)
{
    /// <summary>
    /// The statement the problem is held in as raw source alone, in English, with no solution beside it.
    /// </summary>
    private const string RawEnglishStatement = "the English statement as raw source";

    /// <summary>
    /// The problem the tests read, written in Slovak in full and stated in English alone.
    /// </summary>
    private Guid _problemId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The resolver under test
        services.AddSingleton<IDefenseContentResolver<ProblemTarget>, ProblemDefenseContentResolver>();

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The problem, with a statement and a solution in Slovak
        _problemId = SelectionSeed.NewProposal(
            context, SelectionSeed.NewProposalsRound(context, SelectionSeed.NewSeason(context)), 1, 1, Language.SK);

        // And a statement in English, as raw source with no markdown and no solution beside it
        context.ProblemTexts.Add(new ProblemText
        {
            ProblemId = _problemId,
            DocumentType = DocumentType.Statement,
            Language = Language.EN,
            RawText = RawEnglishStatement,
            IsOriginal = false,
            DateModified = DateTime.UtcNow,
        });

        // Commit the seed
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A problem's statements are its statement in every language it is written in, so a conversation held in one
    /// language reads as current from another. A language with no solution still counts, and one held as raw source
    /// is read the way a defense reads it.
    /// </summary>
    [Fact]
    public Task Statements_are_every_language_statement_and_nothing_else() => RunTestAsync(async resolver =>
    {
        // The problem's statements
        var statements = await resolver.ResolveStatementsAsync(new ProblemTarget(_problemId), CancellationToken.None);

        // The Slovak one and the English one, each under its language, the Slovak solution left out
        Assert.Equal(
            new Dictionary<Language, string>
            {
                [Language.SK] = "Statement 1 in SK",
                [Language.EN] = RawEnglishStatement,
            },
            statements);
    });
}
