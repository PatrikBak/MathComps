using System.Collections.Immutable;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Infrastructure.BulkImport;

namespace MathComps.Cli.BulkImport.Commands;

/// <summary>
/// The structured result of a <c>validate</c> run — the manifest's verdict augmented with the registry and DB
/// findings, plus the create-vs-reuse preview. The shape <c>--json</c> serializes.
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

    /// <summary>
    /// JSON options that emit camelCase property names and lowercase enum values, matching the TS preflight
    /// manifest exactly (e.g. <c>"severity": "error"</c>, not the .NET default <c>"Error"</c>) — one consistent
    /// shape across both sides.
    /// </summary>
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
        WriteIndented = true
    };

    /// <summary>
    /// Serializes the result to JSON with the casing described by <see cref="_jsonOptions"/>.
    /// </summary>
    /// <returns>The result as indented JSON with lowercase enum values.</returns>
    public string ToJson() => JsonSerializer.Serialize(this, _jsonOptions);
}
