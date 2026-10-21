using MathComps.Cli.BulkImport.Commands;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests the one way a folder's result is built, which decides whether the draft reaches the database at all.
/// </summary>
public class ImportResultTests
{
    /// <summary>
    /// A draft with an error of its own never reaches the database, so nothing about it is imported, while a draft
    /// carrying only warnings is imported as any clean one is.
    /// </summary>
    [Fact]
    public async Task Only_a_draft_without_an_error_of_its_own_reaches_the_database()
    {
        // An outcome the database would answer with.
        DraftImportOutcome answer = DraftImportStoppedAtOrphans.IfAny([new TaxonomyOrphan("notacomp")])!;

        // How many times the database was asked.
        var asked = 0;

        // The import, counting each time it runs.
        Task<DraftImportOutcome> Import()
        {
            // One more run.
            asked++;

            // The database's answer.
            return Task.FromResult(answer);
        }

        // A draft with an error.
        var refused = await ImportResult.CheckThenImportAsync([Issue(VerdictSeverity.Error)], Import);

        // A draft with only a warning.
        var warned = await ImportResult.CheckThenImportAsync([Issue(VerdictSeverity.Warning)], Import);

        // Only the warned draft was imported.
        Assert.Equal(1, asked);
        Assert.Null(refused.Outcome);
        Assert.Same(answer, warned.Outcome);
    }

    /// <summary>
    /// Builds an issue of the draft's own, of the given severity.
    /// </summary>
    /// <param name="severity">Whether the issue blocks the draft.</param>
    /// <returns>The issue.</returns>
    private static VerdictError Issue(VerdictSeverity severity) =>
        // An issue on the first problem's statement
        new("p1.sk.md", Half: null, Line: 1, Col: 1, "test-rule", "test message", severity);
}
