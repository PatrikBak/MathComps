using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Services.Defense.Engine;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests <see cref="DefenseReferenceBuilder"/>: the reference the examiner reasons from carries the grading note and
/// the author's hints each under its own heading, the note ahead of the hints so the hints still end it, and a problem
/// with neither keeps its reference as written.
/// </summary>
public class DefenseReferenceBuilderTests
{
    /// <summary>
    /// A problem with neither a note nor hints is argued from its reference exactly as written.
    /// </summary>
    [Fact]
    public void A_problem_with_neither_keeps_its_reference_as_written()
    {
        // Build the reference of a problem with nothing beside its solution.
        var reference = DefenseReferenceBuilder.BuildReference(
            new DefenseProblemContent("statement", "The solution.", [], GradingNote: null));

        // The solution alone.
        Assert.Equal("The solution.", reference);
    }

    /// <summary>
    /// A grading note follows the solution under its heading, which the math check looks for by name, and the line
    /// saying whose note it is. The note's own surrounding whitespace is dropped.
    /// </summary>
    [Fact]
    public void A_note_follows_the_solution_under_its_heading()
    {
        // Build the reference of a problem with a note and no hints.
        var reference = DefenseReferenceBuilder.BuildReference(
            new DefenseProblemContent("statement", "The solution.", [], "\nNeeds a reason: the bound.\n"));

        // The solution, then the note under its heading.
        Assert.Equal(
            """
            The solution.

            ## GRADING NOTES
            (From the problem's author, for marking: what needs a reason in a solution to this problem and what needs none.)

            Needs a reason: the bound.
            """,
            reference);
    }

    /// <summary>
    /// The author's hints follow the solution under their heading, each one numbered in the author's order.
    /// </summary>
    [Fact]
    public void Hints_follow_the_solution_numbered_in_order()
    {
        // Build the reference of a problem with two hints and no note.
        var reference = DefenseReferenceBuilder.BuildReference(
            new DefenseProblemContent("statement", "The solution.", ["Look small.", "Induct."], GradingNote: null));

        // The solution, then the hints under their heading.
        Assert.Equal(
            """
            The solution.

            ## AUTHOR'S HINTS
            (Ordered stages of the solution, from first exploration to the key idea.)

            ### Hint 1
            Look small.

            ### Hint 2
            Induct.
            """,
            reference);
    }

    /// <summary>
    /// With both, the note sits between the solution and the hints, so the reference still ends with the author's
    /// hints as the examiner's prompt says it does.
    /// </summary>
    [Fact]
    public void A_note_sits_between_the_solution_and_the_hints()
    {
        // Build the reference of a problem with a note and a hint.
        var reference = DefenseReferenceBuilder.BuildReference(
            new DefenseProblemContent("statement", "The solution.", ["Look small."], "Needs none: the parity."));

        // The solution, the note, then the hints last.
        Assert.Equal(
            """
            The solution.

            ## GRADING NOTES
            (From the problem's author, for marking: what needs a reason in a solution to this problem and what needs none.)

            Needs none: the parity.

            ## AUTHOR'S HINTS
            (Ordered stages of the solution, from first exploration to the key idea.)

            ### Hint 1
            Look small.
            """,
            reference);
    }
}
