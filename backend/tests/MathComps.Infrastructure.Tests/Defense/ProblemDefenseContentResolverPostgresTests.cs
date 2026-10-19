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
/// problem's texts a defense is argued from, and which count as the statements it has now.
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
    /// The problem the tests read most, first written in English as a statement alone and translated into Slovak in
    /// full.
    /// </summary>
    private Guid _problemId;

    /// <summary>
    /// A problem written and solved in English alone.
    /// </summary>
    private Guid _englishProblemId;

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The resolver under test
        services.AddSingleton<IDefenseContentResolver<ProblemTarget>, ProblemDefenseContentResolver>();

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The round the problems sit in
        var round = SelectionSeed.NewProposalsRound(context, SelectionSeed.NewSeason(context));

        // The problem, with a statement and a solution in Slovak
        _problemId = SelectionSeed.NewProposal(context, round, 1, 1, Language.SK);

        // And its original statement in English, as raw source with no markdown and no solution beside it
        context.ProblemTexts.Add(new ProblemText
        {
            ProblemId = _problemId,
            DocumentType = DocumentType.Statement,
            Language = Language.EN,
            RawText = RawEnglishStatement,
            IsOriginal = true,
            DateModified = DateTime.UtcNow,
        });

        // A second problem, with a statement and a solution in English alone
        _englishProblemId = SelectionSeed.NewProposal(context, round, 2, 2, Language.EN);

        // Commit the seed
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A problem is argued in the student's language where it is solved there, even when that is a translation, and in
    /// the language it was first written in where it is not.
    /// </summary>
    [Fact]
    public Task Content_is_in_the_students_language_where_solved_and_in_the_original_otherwise() =>
        RunTestAsync(async resolver =>
        {
            // The problem solved in Slovak, read by a student reading Slovak
            var translated = await resolver.ResolveAsync(
                new ProblemTarget(_problemId), Language.SK, CancellationToken.None);

            // The Slovak statement and solution, though English is the original
            Assert.NotNull(translated);
            Assert.Equal(
                ("Statement 1 in SK", "Solution 1 in SK"), (translated.Statement, translated.Reference));

            // The problem solved in English alone, read by the same student
            var original = await resolver.ResolveAsync(
                new ProblemTarget(_englishProblemId), Language.SK, CancellationToken.None);

            // The English statement and solution
            Assert.NotNull(original);
            Assert.Equal(("Statement 2 in EN", "Solution 2 in EN"), (original.Statement, original.Reference));
        });

    /// <summary>
    /// A problem solved neither in the student's language nor in the one it was first written in has nothing to argue
    /// from, whatever a third language holds.
    /// </summary>
    [Fact]
    public Task Nothing_resolves_where_neither_the_students_language_nor_the_original_is_solved() =>
        RunTestAsync(async resolver =>
        {
            // The problem read in Czech, which it has no text in, its English original carrying no solution
            var content = await resolver.ResolveAsync(
                new ProblemTarget(_problemId), Language.CS, CancellationToken.None);

            // Nothing, though the Slovak translation is solved
            Assert.Null(content);
        });

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
