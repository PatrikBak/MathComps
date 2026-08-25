using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// An <see cref="IProblemDefenseContentResolver"/> reading a problem's texts straight from the database. Nothing
/// is cached: a problem is read once per conversation opened, and an embargoed one must never be served from a
/// cache that outlives an edit made while its competition is still running.
/// </summary>
/// <param name="dbContextFactory">Creates the contexts the lookups run on.</param>
public sealed class ProblemDefenseContentResolver(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IProblemDefenseContentResolver
{
    /// <inheritdoc/>
    public async Task<DefenseProblemContent?> ResolveAsync(
        ProblemTarget target, Language language, CancellationToken cancellationToken)
    {
        // A fresh context for this lookup.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The problem's statement and solution in this language. Markdown is what the site renders and what the
        // examiner reads; the raw source is what a row without markdown carries.
        var texts = await dbContext.ProblemTexts
            .AsNoTracking()
            .Where(text => text.ProblemId == target.ProblemId && text.Language == language)
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

        // Hints are a handout's authored ladder; an archive problem carries none.
        return new DefenseProblemContent(statement, reference, []);
    }
}
