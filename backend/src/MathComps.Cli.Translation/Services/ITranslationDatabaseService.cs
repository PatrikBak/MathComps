using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

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

    /// <summary>
    /// Retrieves translated problem texts that need parsing (have <see cref="ProblemText.RawText"/>
    /// but no <see cref="ProblemText.ParsedText"/>).
    /// </summary>
    /// <param name="limit">The maximum number of texts to retrieve.</param>
    /// <param name="scope">The scope (statements only, solutions only, or both).</param>
    /// <returns>A list of problem texts that need parsing.</returns>
    Task<List<ProblemTextForParsingDto>> GetTextsNeedingParsingAsync(int limit, TranslationScope scope);

    /// <summary>
    /// Updates the ParsedText for a problem text entry.
    /// </summary>
    /// <param name="problemTextId">The ID of the <see cref="ProblemText"/> to update.</param>
    /// <param name="parsedText">The parsed JSON text.</param>
    Task UpdateParsedTextAsync(Guid problemTextId, string parsedText);

    /// <summary>
    /// Updates the <see cref="ProblemText.RawText"/> for a problem text entry.
    /// </summary>
    /// <param name="problemTextId">The ID of the <see cref="ProblemText"/> to update.</param>
    /// <param name="rawText">The corrected raw TeX text.</param>
    Task UpdateRawTextAsync(Guid problemTextId, string rawText);
}
