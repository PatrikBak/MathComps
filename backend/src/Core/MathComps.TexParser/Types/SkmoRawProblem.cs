using System.Collections.Immutable;

namespace MathComps.TexParser.Types;

/// <summary>
/// A record that associates the original raw problem data with its structured, parsed representation.
/// </summary>
/// <param name="RawProblem">The original, unparsed problem data.</param>
/// <param name="ParsedStatement">The parsed problem statement as a structured <see cref="Text"/> object, or <c><see langword="null"/></c> if not parsed.</param>
/// <param name="ParsedSolution">The parsed problem solution as a structured <see cref="Text"/> object, or <see langword="null"/> if not parsed.</param>
public record class SkmoParsedProblem(
    SkmoRawProblem RawProblem,
    Text? ParsedStatement,
    Text? ParsedSolution
);

/// <summary>
/// Represents the raw data for a single problem from the Slovak Mathematical Olympiad (SKMO) archive.
/// </summary>
/// <param name="OlympiadYear">The edition of the Olympiad.</param>
/// <param name="Category">The competition category (e.g., "A", "B", "C").</param>
/// <param name="Competition">The id of the competition (e.g., "MEMO", "I", "II", "S").</param>
/// <param name="Subcompetition">An optional sub-competition identifier ("T" for 'team').</param>
/// <param name="Order">The sequential number of the problem within its set.</param>
/// <param name="Statement">The raw TeX string of the problem's statement.</param>
/// <param name="Solution">The raw TeX string of the problem's solution.</param>
/// <param name="Authors">A list of the problem's authors. Might be empty if unknown</param>
public record class SkmoRawProblem(
    int OlympiadYear,
    string? Category,
    string Competition,
    string? Subcompetition,
    int Order,
    string Statement,
    string? Solution,
    ImmutableList<string> Authors
)
{
    /// <summary>
    /// Gets a unique, human-readable identifier for the problem.
    /// </summary>
    public string Id => $"{OlympiadYear}-{Category}" +
        $"{(Category is null ? "" : "-")}{Competition}" +
        $"{(Subcompetition is null ? "-" : $"-{Subcompetition}-")}" +
        $"{Order}";
}
