namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Result of a batch tag import operation containing statistics about the import process.
/// </summary>
/// <param name="ImportedCount">Number of <see cref="ProblemTag"/> associations successfully created</param>
/// <param name="SkippedProblemSlugs">List of problem slugs that were skipped because the problems don't exist in the database</param>
public record ImportTagsResult(
    int ImportedCount,
    IReadOnlyList<string> SkippedProblemSlugs
);
