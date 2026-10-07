using System.Collections.Immutable;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace MathComps.Shared.Serialization;

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
    /// <param name="writeIndented">Whether to format the JSON with indentation for readability. Defaults to true for readable output.</param>
    /// <returns>A JSON string representation of the object.</returns>
    public static string ToJson<T>(this T value, bool writeIndented = true)
        // Simple proxy with the right options
        => JsonSerializer.Serialize(value, writeIndented ? _indentedOptions : _compactOptions);

    /// <summary>
    /// Deserializes a JSON string to an object using compact JSON options.
    /// </summary>
    /// <typeparam name="T">The type of object to deserialize.</typeparam>
    /// <param name="json">The JSON string to deserialize.</param>
    /// <returns>The deserialized object.</returns>
    public static T FromJson<T>(this string json)
        => JsonSerializer.Deserialize<T>(json, _compactOptions)
            ?? throw new InvalidOperationException($"Failed to deserialize JSON to type {typeof(T).Name}");

    /// <summary>
    /// Reads a JSON document of objects nested to any depth, with text at every leaf, as each text under its path:
    /// the names of the properties leading down to it, joined by dots.
    /// </summary>
    /// <param name="json">The document.</param>
    /// <returns>Each text by its path.</returns>
    public static ImmutableDictionary<string, string> FlattenJson(this string json)
        // Every leaf under the document's root
        => Leaves(JsonNode.Parse(json), path: "").ToImmutableDictionary();

    /// <summary>
    /// Walks one node of a document of nested objects down to the texts at its leaves.
    /// </summary>
    /// <param name="node">The node.</param>
    /// <param name="path">The node's path, empty for the document's root.</param>
    /// <returns>Each text under the node, by its path.</returns>
    private static IEnumerable<KeyValuePair<string, string>> Leaves(JsonNode? node, string path) => node switch
    {
        // An object leads on to each of its properties, under its own path
        JsonObject properties => properties.SelectMany(property =>
            Leaves(property.Value, path.Length == 0 ? property.Key : $"{path}.{property.Key}")),

        // Text is a leaf
        JsonValue text when text.GetValueKind() == JsonValueKind.String => [new(path, text.GetValue<string>())],

        // A list, a number, a boolean or a null has no place in such a document
        _ => throw new JsonException($"'{path}' holds neither an object nor text."),
    };
}
