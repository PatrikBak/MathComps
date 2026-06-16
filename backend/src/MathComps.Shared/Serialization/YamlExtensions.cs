using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace MathComps.Shared.Serialization;

/// <summary>
/// Extension methods for YAML serialization — the YAML counterpart of the JSON helpers. camelCase naming keeps the
/// emitted keys consistent with the JSON conventions.
/// </summary>
public static class YamlExtensions
{
    /// <summary>
    /// Cached YAML serializer with camelCase naming.
    /// </summary>
    private static readonly ISerializer _serializer = new SerializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    /// <summary>
    /// Cached YAML deserializer with camelCase naming.
    /// </summary>
    private static readonly IDeserializer _deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    // Symmetric serialize half of the ToYaml/FromYaml YAML helper; only FromYaml has a caller today.
    // ReSharper disable once UnusedMember.Global
    /// <summary>
    /// Serializes an object to a YAML string.
    /// </summary>
    /// <typeparam name="T">The type of object to serialize.</typeparam>
    /// <param name="value">The object to serialize.</param>
    /// <returns>A YAML string representation of the object.</returns>
    public static string ToYaml<T>(this T value)
        => _serializer.Serialize(value);

    /// <summary>
    /// Deserializes a YAML string to an object.
    /// </summary>
    /// <typeparam name="T">The type of object to deserialize.</typeparam>
    /// <param name="yaml">The YAML string to deserialize.</param>
    /// <returns>The deserialized object.</returns>
    public static T FromYaml<T>(this string yaml)
        => _deserializer.Deserialize<T>(yaml)
            ?? throw new InvalidOperationException($"Failed to deserialize YAML to type {typeof(T).Name}");
}
