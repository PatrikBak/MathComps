using MathComps.Shared.Extensions;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// The author's-hints section an examiner reads folded into a reference solution: ordered stages of the solution,
/// extra material for the help a stuck candidate gets. Builds the section and carries the marker and prompt guidance
/// an examiner needs to detect and use it, all in one place so the three can't drift apart.
/// </summary>
public static class AuthorHintsSection
{
    /// <summary>
    /// The heading that opens the section — the marker an examiner recognizes it by.
    /// </summary>
    public const string Heading = "## AUTHOR'S HINTS";

    /// <summary>
    /// The prompt guidance for using the section: how to let the author's staged hints shape the help a stuck
    /// candidate gets, without handing over a stage they haven't reached.
    /// </summary>
    public const string UsageNote =
        "The reference material above ends with an \"AUTHOR'S HINTS\" section: the author's step-by-step hints for " +
        "this problem — ordered stages of the solution, each a concrete step that typically resolves the previous " +
        "hint's question and poses the next, running from first exploration toward the key idea. When the candidate " +
        "has help coming, find the stage nearest where they're stuck — for one stuck at the very start, the " +
        "first — and let it shape the help you give: enough to move a student who grasped a step but can't take " +
        "the next, or to clarify one they've half-understood. " +
        "It is reference material, not a script — the candidate may be on a genuinely different route, so adapt to " +
        "the argument in front of you rather than reciting a hint. And each hint is a whole solution step, so it " +
        "does not loosen the rule above: never hand them a stage beyond where they've reached.";

    /// <summary>
    /// Appends the author's hints to a reference as a <see cref="Heading"/> section, so an examiner reads them as the
    /// problem's staged solution and can pitch earned help at the author's granularity. Returns the reference
    /// unchanged when there are no hints.
    /// </summary>
    /// <param name="reference">The reference solution.</param>
    /// <param name="hints">The author's step-by-step hints, each a markdown string; may be null.</param>
    /// <returns>The reference, with the hints section appended when any were given.</returns>
    public static string BuildReference(string reference, IReadOnlyList<string>? hints)
    {
        // No hints: the reference stands as the examiner's only source material.
        if (hints is null || hints.Count == 0)
            return reference;

        // Each hint under its own "Hint N" heading.
        var numberedHints = hints
            .Select((hint, index) => $"### Hint {index + 1}\n{hint}")
            .ToJoinedString("\n\n");

        // The reference followed by the hints, framed as ordered stages of the solution.
        return $"""
            {reference}

            {Heading}
            (Ordered stages of the solution, from first exploration to the key idea.)

            {numberedHints}
            """;
    }
}
