using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Cli.Translation.Services;

/// <summary>
/// Provides database operations for problem translations.
/// </summary>
/// <param name="dbContextFactory">Factory for creating database contexts.</param>
public class TranslationDatabaseService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : ITranslationDatabaseService
{
    /// <inheritdoc/>
    public async Task<List<ProblemForTranslationDto>> GetProblemsNeedingTranslationAsync(
        Language language,
        int limit,
        bool forceRetranslate,
        TranslationScope scope)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Start with nicely sorted problems
        var query = context.Problems.OrderByDefaultProblemSort();

        // Single combined query based on scope and force retranslate flag
        query = scope switch
        {
            // Handle statements-only scope
            TranslationScope.StatementsOnly => query.Where(problem =>
                // If not forcing retranslation, check for missing translations
                ((!forceRetranslate && !problem.Texts.Any(text =>
                    text.Language == language &&
                    text.DocumentType == DocumentType.Statement
                )) || forceRetranslate)

                // We need the statement to translate from
                && problem.Texts.Any(text => text.IsOriginal && text.DocumentType == DocumentType.Statement)
            ),

            // Handle solutions-only scope
            TranslationScope.SolutionsOnly => query.Where(problem =>
                // If not forcing retranslation, check for missing translations
                ((!forceRetranslate && !problem.Texts.Any(text =>
                    text.Language == language &&
                    text.DocumentType == DocumentType.Solution
                )) || forceRetranslate)

                // We need the solution to translate from
                && problem.Texts.Any(text => text.IsOriginal && text.DocumentType == DocumentType.Solution)
            ),

            // Handle both statements and solutions
            TranslationScope.Both => query.Where(problem =>
                // We need at least the statement to translate from (solution is optional)
                problem.Texts.Any(text => text.IsOriginal && text.DocumentType == DocumentType.Statement)

                // If not forcing retranslation, check for missing translations
                && ((!forceRetranslate && (
                    // Check if statement translation is missing (only if statement exists)
                    !problem.Texts.Any(text =>
                        text.Language == language &&
                        text.DocumentType == DocumentType.Statement
                    ) ||
                    // Check if solution translation is missing (only if solution exists in original)
                    (problem.Texts.Any(text => text.IsOriginal && text.DocumentType == DocumentType.Solution) &&
                     !problem.Texts.Any(text =>
                        text.Language == language &&
                        text.DocumentType == DocumentType.Solution
                    ))
                )) || forceRetranslate)
            ),

            // Unhandled scope
            _ => throw new ArgumentException($"Unsupported translation scope: {scope}")
        };

        // Limit the problems
        query = query.Take(limit);

        // Execute the query with a conversion to DTOs
        return await query
            .Select(problem => new ProblemForTranslationDto(
                problem.Id,
                problem.Slug,
                // Get the original language from the first original text
                problem.Texts
                    .Where(text => text.IsOriginal)
                    .Select(text => text.Language)
                    .First(),
                // Get statement text from ProblemTexts (original language)
                problem.Texts
                    .Where(text => text.DocumentType == DocumentType.Statement && text.IsOriginal)
                    .Select(text => text.RawText!)
                    .First(),
                // Get solution text from ProblemTexts (original language) if it exists
                problem.Texts
                    .Where(text => text.DocumentType == DocumentType.Solution && text.IsOriginal)
                    .Select(text => text.RawText)
                    .FirstOrDefault()
            ))
            .ToListAsync();
    }

    /// <inheritdoc/>
    public async Task UpsertTranslationAsync(ProblemTranslationUpsertDto translation)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Current timestamp for tracking modifications
        var now = DateTime.UtcNow;

        // Upsert statement if provided
        if (translation.StatementText != null)
        {
            // Find it in the DB
            var existingStatement = await context.ProblemTexts
                .FirstOrDefaultAsync(text =>
                    text.ProblemId == translation.ProblemId &&
                    text.Language == translation.Language &&
                    text.DocumentType == DocumentType.Statement);

            // If the statement exists
            if (existingStatement != null)
            {
                // Update existing statement
                existingStatement.RawText = translation.StatementText;
                existingStatement.DateModified = now;
                existingStatement.IsOriginal = false;
            }
            // If the statement doesn't exist
            else
            {
                // Create new statement
                context.ProblemTexts.Add(new ProblemText
                {
                    ProblemId = translation.ProblemId,
                    Language = translation.Language,
                    DocumentType = DocumentType.Statement,
                    RawText = translation.StatementText,
                    DateModified = now,
                    IsOriginal = false
                });
            }
        }

        // If the solution exists
        if (translation.SolutionText != null)
        {
            // Find it in the db
            var existingSolution = await context.ProblemTexts
                .FirstOrDefaultAsync(text =>
                    text.ProblemId == translation.ProblemId &&
                    text.Language == translation.Language &&
                    text.DocumentType == DocumentType.Solution);

            // If the solution exists
            if (existingSolution != null)
            {
                // Update existing solution
                existingSolution.RawText = translation.SolutionText;
                existingSolution.DateModified = now;
                existingSolution.IsOriginal = false;
            }
            // If the solution doesn't exist
            else
            {
                // Create new solution
                context.ProblemTexts.Add(new ProblemText
                {
                    ProblemId = translation.ProblemId,
                    Language = translation.Language,
                    DocumentType = DocumentType.Solution,
                    RawText = translation.SolutionText,
                    DateModified = now,
                    IsOriginal = false
                });
            }
        }

        // Save changes
        await context.SaveChangesAsync();
    }

    /// <inheritdoc/>
    public async Task<List<ProblemTextForParsingDto>> GetTextsNeedingParsingAsync(int limit, TranslationScope scope)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Start with uniquely sorted translations (non-original) that have RawText but no ParsedText
        var query = context.Problems
            .OrderByDefaultProblemSort()
            .SelectMany(problem => problem.Texts)
            .Where(text => !text.IsOriginal && text.RawText != null && text.ParsedText == null);

        // Filter by scope
        query = scope switch
        {
            TranslationScope.StatementsOnly => query.Where(text => text.DocumentType == DocumentType.Statement),
            TranslationScope.SolutionsOnly => query.Where(text => text.DocumentType == DocumentType.Solution),
            TranslationScope.Both => query,
            _ => throw new ArgumentException($"Unsupported translation scope: {scope}")
        };

        // Limit the number of results
        query = query.Take(limit);

        // Execute the query with a conversion to DTOs
        return await query
            .Select(text => new ProblemTextForParsingDto(
                text.Id,
                text.ProblemId,
                text.Problem.Slug,
                text.Language,
                text.DocumentType,
                text.RawText!
            ))
            .ToListAsync();
    }

    /// <inheritdoc/>
    public async Task UpdateParsedTextAsync(Guid problemTextId, string parsedText)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Update the ParsedText field directly
        await context.ProblemTexts
            .Where(text => text.Id == problemTextId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(text => text.ParsedText, parsedText)
                .SetProperty(text => text.DateModified, DateTime.UtcNow));
    }

    /// <inheritdoc/>
    public async Task UpdateRawTextAsync(Guid problemTextId, string rawText)
    {
        // Get DB access
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Update the RawText field directly
        await context.ProblemTexts
            .Where(text => text.Id == problemTextId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(text => text.RawText, rawText)
                .SetProperty(text => text.DateModified, DateTime.UtcNow));
    }
}
