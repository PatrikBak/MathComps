using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Translation.Services;

/// <summary>
/// Defines the contract for database operations related to problem translations.
/// </summary>
public interface ITranslationDatabaseService
{
    /// <summary>
    /// Retrieves problems that need translation into the specified language.
    /// </summary>
    /// <param name="language">The target language for translation.</param>
    /// <param name="limit">The maximum number of problems to retrieve.</param>
    /// <param name="forceRetranslate">If true, includes problems that already have translations.</param>
    /// <param name="scope">The scope of translation (statements only, solutions only, or both).</param>
    /// <returns>A list of problems that need translation.</returns>
    Task<List<ProblemForTranslationDto>> GetProblemsNeedingTranslationAsync(
        Language language,
        int limit,
        bool forceRetranslate,
        TranslationScope scope);

    /// <summary>
    /// Upserts translated problem texts into the database.
    /// </summary>
    /// <param name="translation">The translation data to upsert.</param>
    Task UpsertTranslationAsync(ProblemTranslationUpsertDto translation);
}
