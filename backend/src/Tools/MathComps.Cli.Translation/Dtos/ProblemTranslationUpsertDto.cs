using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Translation.Dtos;

/// <summary>
/// DTO for upserting translated problem texts into the database.
/// </summary>
/// <param name="ProblemId">The unique identifier of the problem.</param>
/// <param name="Language">The target language of the translation.</param>
/// <param name="StatementText">The translated statement text (null if only translating solutions).</param>
/// <param name="SolutionText">The translated solution text (null if no solution exists or only translating statements).</param>
public record ProblemTranslationUpsertDto(
    Guid ProblemId,
    Language Language,
    string? StatementText,
    string? SolutionText
);
