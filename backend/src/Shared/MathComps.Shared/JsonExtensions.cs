using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MathComps.Shared;

/// <summary>
/// Extension methods for JSON serialization operations.
/// </summary>
public static class JsonExtensions
{
    /// <summary>
    /// Creates base JSON serializer options with common configuration.
    /// </summary>
    /// <param name="writeIndented">Whether to format the JSON with indentation.</param>
    /// <returns>Configured JsonSerializerOptions instance.</returns>
    private static JsonSerializerOptions CreateOptions(bool writeIndented) => new()
    {
        // Use camelCase for property names to match JavaScript conventions
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,

        // Ignore null values to reduce output size
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

        // Preserve diacritics and special characters in the output
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,

        // Convert enums to their string names
        Converters = { new JsonStringEnumConverter() },

        // Set indentation preference
        WriteIndented = writeIndented
    };

    /// <summary>
    /// Cached JSON serializer options for compact output (default).
    /// </summary>
    private static readonly JsonSerializerOptions _compactOptions = CreateOptions(writeIndented: false);

    /// <summary>
    /// Cached JSON serializer options for indented output.
    /// </summary>
    private static readonly JsonSerializerOptions _indentedOptions = CreateOptions(writeIndented: true);

    /// <summary>
    /// Serializes an object to a JSON string using consistent options across the application.
    /// </summary>
    /// <typeparam name="T">The type of object to serialize.</typeparam>
    /// <param name="value">The object to serialize.</param>
    /// <param name="writeIndented">Whether to format the JSON with indentation for readability. Defaults to false for compact output.</param>
    /// <returns>A JSON string representation of the object.</returns>
    public static string ToJson<T>(this T value, bool writeIndented = false)
        // Simple proxy with the right options
        => JsonSerializer.Serialize(value, writeIndented ? _indentedOptions : _compactOptions);
}
