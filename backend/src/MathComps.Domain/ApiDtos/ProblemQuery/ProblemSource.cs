using MathComps.Domain.ApiDtos.Helpers;

namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Canonical source metadata for a problem within a competition.
/// </summary>
/// <param name="Season">Season/year of the competition.</param>
/// <param name="Competition">Competition name and slug.</param>
/// <param name="Round">Optional round.</param>
/// <param name="Category">Optional category (e.g., 'A', 'B', 'Z9').</param>
/// <param name="Number">Ordinal number within the given context, e.g. the 6th problem.</param>
public record ProblemSource(
    LabeledSlug Season,
    LabeledSlug Competition,
    LabeledSlug? Round,
    LabeledSlug? Category,
    int Number
);
