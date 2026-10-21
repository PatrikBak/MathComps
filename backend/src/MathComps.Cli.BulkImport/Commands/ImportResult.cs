using System.Collections.Immutable;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The structured result of importing one draft folder: every issue the draft raised on its own, plus what the import
/// did, or would have done, which carries every reason the database refused it. Built only by
/// <see cref="CheckThenImportAsync"/>, so its <see cref="Outcome"/> is null exactly when the draft failed its own
/// checks.
/// </summary>
public sealed record ImportResult
{
    /// <summary>
    /// Pairs the draft's issues with the import's outcome, the way <see cref="CheckThenImportAsync"/> decides.
    /// </summary>
    /// <param name="draftIssues"><inheritdoc cref="DraftIssues" path="/summary"/></param>
    /// <param name="outcome"><inheritdoc cref="Outcome" path="/summary"/></param>
    private ImportResult(ImmutableArray<VerdictError> draftIssues, DraftImportOutcome? outcome)
    {
        // The draft's own issues.
        DraftIssues = draftIssues;

        // The database's answer, when it was asked.
        Outcome = outcome;
    }

    /// <summary>
    /// Every issue the draft raised on its own.
    /// </summary>
    public ImmutableArray<VerdictError> DraftIssues { get; }

    /// <summary>
    /// What the import did, or would have done, or null when the draft failed its own checks and the database was never
    /// consulted.
    /// </summary>
    public DraftImportOutcome? Outcome { get; }

    /// <summary>
    /// Whether the folder passes — true when the draft raised no error of its own and the database took it; warnings
    /// alone still pass.
    /// </summary>
    public bool Ok => DraftIssues.IsOk() && Outcome is { IsRefused: false };

    /// <summary>
    /// Imports a draft only when it is clean on its own terms, since the import takes for granted what those checks
    /// verify.
    /// </summary>
    /// <param name="draftIssues"><inheritdoc cref="DraftIssues" path="/summary"/></param>
    /// <param name="import">The import of the draft, run only when no issue of the draft's own is an error.</param>
    /// <returns>The folder's result.</returns>
    public static async Task<ImportResult> CheckThenImportAsync(
        IReadOnlyList<VerdictError> draftIssues, Func<Task<DraftImportOutcome>> import) =>
        // The database's answer for a clean draft, none for one failing its own checks
        new([.. draftIssues], draftIssues.IsOk() ? await import() : null);
}
