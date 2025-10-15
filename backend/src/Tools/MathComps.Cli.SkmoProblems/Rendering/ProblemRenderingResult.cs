using MathComps.TexParser.Types;
using System.Collections.Immutable;

namespace MathComps.Cli.SkmoProblems.Rendering;

/// <summary>
/// Represents the final output for a single problem after parsing and rendering attempts.
/// </summary>
/// <param name="ParsedProblem">The structured representation of the parsed problem statement and solution.</param>
/// <param name="UnknownCommands">A set of TeX commands that were found in the source but are not known to the parser.</param>
/// <param name="KatexError">The error message returned by KaTeX during math rendering, or <see langword="null"/> if rendering was successful.</param>
public record ProblemRenderingResult(
    SkmoParsedProblem ParsedProblem,
    ImmutableHashSet<string> UnknownCommands,
    string? KatexError
);
