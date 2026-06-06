using System.Collections.Immutable;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The structured outcome of an <c>apply</c> run: what the apply service did, paired with the validation warnings
/// that didn't block it.
/// </summary>
/// <param name="Applied">What the apply service created, reused, wrote and uploaded.</param>
/// <param name="Warnings">The non-blocking validation issues the run proceeded through (e.g. in-place
/// overwrites).</param>
public record ApplyResult(
    DraftApplyResult Applied,
    ImmutableArray<VerdictError> Warnings);
