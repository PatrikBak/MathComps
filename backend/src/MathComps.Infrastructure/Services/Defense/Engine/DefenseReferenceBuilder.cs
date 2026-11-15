using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Shared.Extensions;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Builds the reference the examiner reasons from, folding in a problem's grading note under a GRADING NOTES heading
/// and its author hints under <see cref="Heading"/>: ordered stages of the solution, extra material for the help a
/// stuck candidate gets. The hints always come last.
/// </summary>
public static class DefenseReferenceBuilder
{
    /// <summary>
    /// The heading that opens the author's-hints section, the marker an examiner recognizes it by.
    /// </summary>
    public const string Heading = "## AUTHOR'S HINTS";

    /// <summary>
    /// Builds the reference for one problem: the solution, then its grading note under a GRADING NOTES heading so
    /// the math check marks the problem the way its author does, then its author hints under <see cref="Heading"/> so
    /// an examiner reads them as the problem's staged solution and can pitch earned help at the author's granularity.
    /// Returns the reference unchanged when the problem carries neither, a blank note counting as none.
    /// </summary>
    /// <param name="problem">The problem's resolved content.</param>
    /// <returns>The reference, ready for the examiner to reason from.</returns>
    public static string BuildReference(DefenseProblemContent problem)
    {
        // The note section's heading, and the line under it saying whose note it is and what it settles.
        const string notesHeading = "## GRADING NOTES";
        const string notesLead =
            "(From the problem's author, for marking: what needs a reason in a solution to this problem and what "
            + "needs none.)";

        // The note, framed as the author's word on what needs a reason, when the problem has one that says anything.
        var notesSection = !string.IsNullOrWhiteSpace(problem.GradingNote)
            ? $"""
                {notesHeading}
                {notesLead}

                {problem.GradingNote.Trim()}
                """
            : null;

        // Each hint under its own "Hint N" heading.
        var numberedHints = problem.Hints
            .Select((hint, index) => $"### Hint {index + 1}\n{hint}")
            .ToJoinedString("\n\n");

        // The hints, framed as ordered stages of the solution, when the problem has any.
        var hintsSection = problem.Hints.Count > 0
            ? $"""
                {Heading}
                (Ordered stages of the solution, from first exploration to the key idea.)

                {numberedHints}
                """
            : null;

        // The reference followed by whichever sections the problem has, the hints last.
        return new[] { problem.Reference, notesSection, hintsSection }
            .OfType<string>()
            .ToJoinedString("\n\n");
    }
}
