using System.Collections.Immutable;

namespace MathComps.Cli.BulkImport.Manifest;

/// <summary>
/// Pass/fail logic over a flat list of <see cref="VerdictError"/>s, kept in one place so the verdict is derived
/// exactly as the TS preflight's <c>isOk</c> does (no stored <c>ok</c> flag).
/// </summary>
public static class VerdictExtensions
{
    /// <summary>
    /// A run passes only when nothing rises to <see cref="VerdictSeverity.Error"/> — warnings alone (e.g. an
    /// orphaned image) don't fail it.
    /// </summary>
    /// <param name="errors">Every issue collected across the preflight, registry and DB checks.</param>
    /// <returns>True when no error-severity issue is present.</returns>
    public static bool IsOk(this IEnumerable<VerdictError> errors) =>
        !errors.Any(error => error.Severity == VerdictSeverity.Error);

    /// <summary>
    /// Orders issues deterministically: by file, then by source position, so the same draft always reports in the
    /// same order regardless of which check produced each issue.
    /// </summary>
    /// <param name="errors">The issues to order.</param>
    /// <returns>The issues sorted by file then line then column.</returns>
    public static ImmutableArray<VerdictError> InDisplayOrder(this IEnumerable<VerdictError> errors) =>
        [.. errors
            .OrderBy(error => error.File, StringComparer.Ordinal)
            .ThenBy(error => error.Line ?? int.MinValue)
            .ThenBy(error => error.Col ?? int.MinValue)];
}
