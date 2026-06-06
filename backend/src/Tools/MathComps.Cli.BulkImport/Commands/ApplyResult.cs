using System.Collections.Immutable;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The structured result of an <c>apply</c> run — what was written to the database (the service's
/// <see cref="DraftApplyResult"/>) paired with the validation warnings that didn't block it (the overwrites). The
/// shape <c>--json</c> serializes.
/// </summary>
/// <param name="Applied">What the apply service created, reused, wrote and uploaded.</param>
/// <param name="Warnings">The non-blocking validation issues the run proceeded through (e.g. in-place
/// overwrites).</param>
public record ApplyResult(
    DraftApplyResult Applied,
    ImmutableArray<VerdictError> Warnings);
