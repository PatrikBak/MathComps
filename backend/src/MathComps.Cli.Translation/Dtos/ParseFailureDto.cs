using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Cli.Translation.Dtos;

/// <summary>
/// Represents a failed parse attempt for manual recovery.
/// Serialized to a YAML file so users can fix the raw text and rerun.
/// </summary>
/// <param name="ProblemTextId">The ID of the <see cref="ProblemText"/> entry.</param>
/// <param name="ProblemId">The ID of the parent <see cref="Problem"/>.</param>
/// <param name="ProblemSlug">The problem slug for identification.</param>
/// <param name="Language">The language of the <see cref="ProblemText"/>.</param>
/// <param name="DocumentType">Whether this is a statement or solution.</param>
/// <param name="RawText">The raw TeX text that failed to parse.</param>
/// <param name="Error">The error message from the parser.</param>
public record ParseFailureDto(
    Guid ProblemTextId,
    Guid ProblemId,
    string ProblemSlug,
    Language Language,
    DocumentType DocumentType,
    string RawText,
    string Error
)
{
    /// <summary>
    /// Parameterless constructor for YAML deserialization.
    /// </summary>
    public ParseFailureDto() : this(Guid.Empty, Guid.Empty, "", default, default, "", "") { }
}
