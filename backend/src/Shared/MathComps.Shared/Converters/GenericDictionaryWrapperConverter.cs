using System.Collections.Concurrent;
using System.Collections.Immutable;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MathComps.Shared.Converters;

/// <summary>
/// A generic JSON converter for records that wrap <see cref="IReadOnlyDictionary{TKey, TValue}"/> data.
/// This converter allows serialization/deserialization of records without requiring
/// the "Data" property to be explicitly present in the JSON.
/// </summary>
/// <typeparam name="TRecord">The record type that wraps dictionary data</typeparam>
public class GenericDictionaryWrapperConverter<TRecord> : JsonConverter<TRecord>
    where TRecord : class
{
    /// <summary>
    /// The property that contains the dictionary data in the record.
    /// </summary>
    private readonly PropertyInfo _dataProperty;

    /// <summary>
    /// Initializes a new instance of the <see cref="GenericDictionaryWrapperConverter{TRecord}"/>.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the record type doesn't have exactly one property that implements IReadOnlyDictionary
    /// or when there's no constructor that takes the dictionary parameter.
    /// </exception>
    public GenericDictionaryWrapperConverter()
    {
        // Find the single property...
        _dataProperty = typeof(TRecord).GetProperties(BindingFlags.Public | BindingFlags.Instance)
            // That is a dictionary
            .SingleOrDefault(property => IsDictionaryType(property.PropertyType))
            // Enforce it
            ?? throw new InvalidOperationException($"Record type {typeof(TRecord).Name} must have exactly one dictionary property.");

        // Validate that there's a constructor that takes the dictionary parameter
        if (typeof(TRecord).GetConstructor([_dataProperty.PropertyType]) == null)
            throw new InvalidOperationException($"Record type {typeof(TRecord).Name} must have a constructor that takes a {_dataProperty.PropertyType.Name} parameter.");
    }

    /// <inheritdoc/>
    public override TRecord? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        // Deserialize dictionary directly from JSON
        var dictionary = JsonSerializer.Deserialize(ref reader, _dataProperty.PropertyType, options)
            // Ensure it doesn't parse to null
            ?? throw new JsonException($"Failed to deserialize dictionary for type {typeof(TRecord).Name}");

        // Get the instance constructor that takes the dictionary (already validated in constructor)
        var constructor = typeof(TRecord).GetConstructor([_dataProperty.PropertyType])!;

        // Create the record instance
        return (TRecord)constructor.Invoke([dictionary]);
    }

    /// <inheritdoc/>
    public override void Write(Utf8JsonWriter writer, TRecord value, JsonSerializerOptions options)
    {
        // Null values are written as null (deep)
        if (value == null)
        {
            writer.WriteNullValue();
            return;
        }

        // Get dictionary data
        var dictionary = _dataProperty.GetValue(value);

        // Null dictionaries are written as null
        if (dictionary == null)
        {
            writer.WriteNullValue();
            return;
        }

        // If we got here, serialize the dictionary directly
        JsonSerializer.Serialize(writer, dictionary, _dataProperty.PropertyType, options);
    }

    /// <summary>
    /// Checks if the given type is a dictionary type that can be serialized/deserialized.
    /// </summary>
    /// <param name="type">The type to check</param>
    /// <returns>True if the type is a dictionary type</returns>
    private static bool IsDictionaryType(Type type) => type.IsGenericType && (
        // Direct matches
        type.GetGenericTypeDefinition() == typeof(IReadOnlyDictionary<,>) ||
        type.GetGenericTypeDefinition() == typeof(IDictionary<,>) ||
        type.GetGenericTypeDefinition() == typeof(Dictionary<,>) ||
        type.GetGenericTypeDefinition() == typeof(ImmutableDictionary<,>) ||
        type.GetGenericTypeDefinition() == typeof(ConcurrentDictionary<,>) ||
        // Check if it implements...
        type.GetInterfaces().Any(@interface => @interface.IsGenericType &&
            // ...IReadOnlyDictionary
            @interface.GetGenericTypeDefinition() == typeof(IReadOnlyDictionary<,>)));
}
