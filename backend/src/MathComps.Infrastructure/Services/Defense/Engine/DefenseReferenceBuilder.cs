using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Shared.Extensions;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Builds the reference the examiner reasons from, folding a problem's author hints into it under
/// <see cref="Heading"/>: ordered stages of the solution, extra material for the help a stuck candidate gets.
/// </summary>
public static class DefenseReferenceBuilder
{
    /// <summary>
    /// The heading that opens the author's-hints section, the marker an examiner recognizes it by.
    /// </summary>
    public const string Heading = "## AUTHOR'S HINTS";

    /// <summary>
    /// Builds the reference for one problem, appending its author hints under <see cref="Heading"/> so an examiner
    /// reads them as the problem's staged solution and can pitch earned help at the author's granularity. Returns
    /// the reference unchanged when the problem carries no hints.
    /// </summary>
    /// <param name="problem">The problem's resolved content.</param>
    /// <returns>The reference, ready for the examiner to reason from.</returns>
    public static string BuildReference(DefenseProblemContent problem)
    {
        // No hints: the reference stands as the examiner's only source material.
        if (problem.Hints.Count == 0)
            return problem.Reference;

        // Each hint under its own "Hint N" heading.
        var numberedHints = problem.Hints
            .Select((hint, index) => $"### Hint {index + 1}\n{hint}")
            .ToJoinedString("\n\n");

        // The reference followed by the hints, framed as ordered stages of the solution.
        return $"""
            {problem.Reference}

            {Heading}
            (Ordered stages of the solution, from first exploration to the key idea.)

            {numberedHints}
            """;
    }
}
