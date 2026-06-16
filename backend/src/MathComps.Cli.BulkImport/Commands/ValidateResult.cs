using System.Collections.Immutable;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The structured result of a <c>validate</c> run — the manifest's verdict augmented with the registry and DB
/// findings, plus the create-vs-reuse preview.
/// </summary>
/// <param name="Issues">Every issue across preflight, registry and DB checks, in display order.</param>
/// <param name="DbPreview">The read-only create-vs-reuse preview, or null when the DB wasn't consulted.</param>
public record ValidateResult(
    ImmutableArray<VerdictError> Issues,
    DraftDbPreview? DbPreview)
{
    /// <summary>
    /// Whether the run passes — true when no issue reaches error severity; warnings alone still pass. Derived
    /// from <see cref="Issues"/>, so it can't drift from them.
    /// </summary>
    public bool Ok => Issues.IsOk();
}
