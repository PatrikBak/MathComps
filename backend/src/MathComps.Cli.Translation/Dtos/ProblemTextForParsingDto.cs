using MathComps.Domain.EfCoreEntities;
using MathComps.Shared;

namespace MathComps.Cli.Translation.Dtos;

/// <summary>
/// DTO for a problem text that needs parsing (has <see cref="ProblemText.RawText"/> 
/// but no <see cref="ProblemText.ParsedText"/>).
/// </summary>
/// <param name="ProblemTextId">The ID of the <see cref="ProblemText"/> entry.</param>
/// <param name="ProblemId">The ID of the parent <see cref="Problem"/>.</param>
/// <param name="ProblemSlug">The problem slug for identification.</param>
/// <param name="Language">The language of the <see cref="ProblemText"/>.</param>
/// <param name="DocumentType">Whether this is a statement or solution.</param>
/// <param name="RawText">The raw TeX text to parse.</param>
public record ProblemTextForParsingDto(
    Guid ProblemTextId,
    Guid ProblemId,
    string ProblemSlug,
    Language Language,
    DocumentType DocumentType,
    string RawText
);
