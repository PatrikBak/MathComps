using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Builds imports that went through the whole draft, by the one way the import itself builds them.
/// </summary>
public static class FinishedImports
{
    /// <summary>
    /// Settles a dry run that found what is given, with nothing pending to flush.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="DraftImportFinished.Findings" path="/summary"/></param>
    /// <returns>The finished dry run.</returns>
    public static Task<DraftImportFinished> DryRunAsync(DraftImportFindings findings) =>
        // A dry run never reaches its landing
        DraftImportFinished.SettleAsync(findings, dryRun: true, flush: () => Task.CompletedTask,
            land: () => throw new InvalidOperationException("A dry run never lands."));
}
