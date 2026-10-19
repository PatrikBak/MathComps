using System.Linq.Expressions;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// An <see cref="IDefenseContentResolver{TTarget}"/> for archive problems, reading a problem's texts straight from the
/// database. Nothing is cached: a problem is read once per conversation opened, and an embargoed one must never be
/// served from a cache that outlives an edit made while its competition is still running.
/// </summary>
/// <remarks>
/// A problem resolves to content only in a language holding both its statement and its solution: the student's
/// language where it holds both, and otherwise the language the problem was first written in. A statement with no
/// solution beside it still counts among the statements it has.
/// </remarks>
/// <param name="dbContextFactory">Creates the contexts the lookups run on.</param>
public sealed class ProblemDefenseContentResolver(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IDefenseContentResolver<ProblemTarget>
{
    /// <inheritdoc/>
    public async Task<DefenseProblemContent?> ResolveAsync(
        ProblemTarget target, Language language, CancellationToken cancellationToken)
    {
        // A fresh context for this lookup.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The problem in the student's language, or else in the language it was first written in.
        return await ContentAsync(dbContext, target.ProblemId, text => text.Language == language, cancellationToken)
            ?? await ContentAsync(dbContext, target.ProblemId, text => text.IsOriginal, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<Language, string>> ResolveStatementsAsync(
        ProblemTarget target, CancellationToken cancellationToken)
    {
        // A fresh context for this lookup.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The problem's statement in every language it is written in, each read the way a defense reads one, and
        // only where the row holds one.
        return await dbContext.ProblemTexts
            .AsNoTracking()
            .Where(text => text.ProblemId == target.ProblemId
                && text.DocumentType == DocumentType.Statement
                && (text.MarkdownText ?? text.RawText) != null)
            .ToDictionaryAsync(text => text.Language, text => (text.MarkdownText ?? text.RawText)!, cancellationToken);
    }

    /// <summary>
    /// Reads what the examiner is told about a problem out of its texts in one language.
    /// </summary>
    /// <param name="dbContext">The context the lookup runs on.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="inLanguage">Picks out the problem's texts in the one language to read.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The problem's content, or null where the language picked lacks its statement or its solution.</returns>
    private static async Task<DefenseProblemContent?> ContentAsync(
        MathCompsDbContext dbContext,
        Guid problemId,
        Expression<Func<ProblemText, bool>> inLanguage,
        CancellationToken cancellationToken)
    {
        // The problem's statement, solution and hints in the language picked. Markdown is what the site renders and
        // what the examiner reads; the raw source is what a row without markdown carries.
        var texts = await dbContext.ProblemTexts
            .AsNoTracking()
            .Where(text => text.ProblemId == problemId)
            .Where(inLanguage)
            .Select(text => new { text.DocumentType, Body = text.MarkdownText ?? text.RawText })
            .ToListAsync(cancellationToken);

        // What both sides see.
        var statement = texts
            .FirstOrDefault(text => text.DocumentType == DocumentType.Statement)?.Body;

        // What the examiner reasons from.
        var reference = texts
            .FirstOrDefault(text => text.DocumentType == DocumentType.Solution)?.Body;

        // Neither half can be missing: there is nothing to defend without a statement, and without a reference
        // the examiner would be marking its own guess.
        if (string.IsNullOrWhiteSpace(statement) || string.IsNullOrWhiteSpace(reference))
            return null;

        // The author's ladder, stored as one document and read back as the list the examiner is given.
        var hints = HintsDocument.Split(texts
            .FirstOrDefault(text => text.DocumentType == DocumentType.Hints)?.Body);

        // Everything the examiner reads about the problem.
        return new DefenseProblemContent(statement, reference, hints);
    }
}
