using MathComps.Shared;

namespace MathComps.Cli.Translation.Dtos;

/// <summary>
/// DTO representing a problem that needs translation.
/// Contains the problem's basic information and original language texts.
/// </summary>
/// <param name="Id">The unique identifier of the problem.</param>
/// <param name="Slug">The URL-friendly identifier of the problem.</param>
/// <param name="OriginalLanguage">The original language of the problem.</param>
/// <param name="StatementText">The statement text in the original language.</param>
/// <param name="SolutionText">The solution text in the original language (null if no solution exists).</param>
public record ProblemForTranslationDto(
    Guid Id,
    string Slug,
    Language OriginalLanguage,
    string StatementText,
    string? SolutionText
);
