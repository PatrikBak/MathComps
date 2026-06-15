using System.Collections.Immutable;
using System.Text.Json;
using System.Text.Json.Serialization;
using MathComps.Shared.Serialization;

namespace MathComps.Shared.Tests.Serialization;

/// <summary>
/// Test cases for the <see cref="GenericDictionaryWrapperConverter{T}"/> to ensure it properly handles
/// serialization and deserialization of records that wrap dictionary data.
/// </summary>
public class GenericDictionaryWrapperConverterTests
{
    /// <summary>
    /// Creates <see cref="JsonSerializerOptions"/> configured with the <see cref="GenericDictionaryWrapperConverter{T}"/> for the specified type.
    /// </summary>
    /// <typeparam name="T">The record type that wraps a dictionary</typeparam>
    /// <returns><see cref="JsonSerializerOptions"/> with the appropriate converter configured</returns>
    private static JsonSerializerOptions CreateOptions<T>() where T : class => new()
    {
        Converters = { new GenericDictionaryWrapperConverter<T>() }
    };

    #region Test Record Types

    /// <summary>
    /// A standalone enum used to exercise enum-keyed dictionaries — the converter is domain-independent, so the
    /// test owns its sample enum rather than borrowing a real domain type.
    /// </summary>
    public enum TestTagCategory
    {
        /// <summary>First sample category.</summary>
        Area,

        /// <summary>Second sample category.</summary>
        Technique
    }

    /// <summary>
    /// Test record that wraps a simple <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestSimpleRecord>))]
    public record TestSimpleRecord(ImmutableDictionary<string, int> Data);

    /// <summary>
    /// Test record that wraps a complex <see cref="ImmutableDictionary{TKey, TValue}"/> with <see cref="TestTagCategory"/> enum keys
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestComplexRecord>))]
    public record TestComplexRecord(ImmutableDictionary<TestTagCategory, string[]> Data);

    /// <summary>
    /// Test record that wraps a nested <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestNestedRecord>))]
    public record TestNestedRecord(ImmutableDictionary<string, ImmutableDictionary<int, bool>> Data);

    #endregion

    #region Serialization Tests

    /// <summary>
    /// Serializing a record emits only the wrapped dictionary's entries, dropping the record wrapper.
    /// </summary>
    [Fact]
    public void Serialize_SimpleRecord_ShouldSerializeOnlyDictionaryData()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var record = new TestSimpleRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create("key1", 1),
                KeyValuePair.Create("key2", 2)
            ]));

        // Act
        var json = JsonSerializer.Serialize(record, options);

        // Assert
        // Note: Dictionary order may vary, so we check for the presence of expected content
        Assert.Contains("\"key1\":1", json);
        Assert.Contains("\"key2\":2", json);
    }

    /// <summary>
    /// Serializing a record with enum-keyed dictionary values emits the enum names and their array values.
    /// </summary>
    [Fact]
    public void Serialize_ComplexRecord_ShouldSerializeOnlyDictionaryData()
    {
        // Arrange
        var options = CreateOptions<TestComplexRecord>();

        var record = new TestComplexRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create(TestTagCategory.Area, new[] { "algebra", "geometry" }),
                KeyValuePair.Create(TestTagCategory.Technique, new[] { "induction" })
            ]));

        // Act
        var json = JsonSerializer.Serialize(record, options);

        // Assert
        // Note: Enum serialization uses string names by default, and dictionary order may vary
        Assert.Contains("\"Area\":[\"algebra\",\"geometry\"]", json);
        Assert.Contains("\"Technique\":[\"induction\"]", json);
    }

    /// <summary>
    /// Serializing a record whose dictionary nests another dictionary emits the nested structure.
    /// </summary>
    [Fact]
    public void Serialize_NestedRecord_ShouldSerializeOnlyDictionaryData()
    {
        // Arrange
        var options = CreateOptions<TestNestedRecord>();
        var record = new TestNestedRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create(
                    "outer1",
                    ImmutableDictionary.CreateRange([
                        KeyValuePair.Create(1, true),
                        KeyValuePair.Create(2, false)
                    ])),
                KeyValuePair.Create(
                    "outer2",
                    ImmutableDictionary.CreateRange([
                        KeyValuePair.Create(3, true)
                    ]))
            ]));

        // Act
        var json = JsonSerializer.Serialize(record, options);

        // Assert
        // Note: Dictionary order may vary, so we check for the presence of expected content
        Assert.Contains("\"outer1\":{\"1\":true,\"2\":false}", json);
        Assert.Contains("\"outer2\":{\"3\":true}", json);
    }

    /// <summary>
    /// Serializing a null record writes a JSON null.
    /// </summary>
    [Fact]
    public void Serialize_NullRecord_ShouldSerializeNull()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        TestSimpleRecord? record = null;

        // Act
        var json = JsonSerializer.Serialize(record, options);

        // Assert
        Assert.Equal("null", json);
    }

    #endregion

    #region Deserialization Tests

    /// <summary>
    /// Deserializing dictionary JSON reconstructs a simple record with its entries.
    /// </summary>
    [Fact]
    public void Deserialize_SimpleRecord_ShouldCreateRecordFromDictionaryJson()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var json = """{"key1":1,"key2":2}""";

        // Act
        var record = JsonSerializer.Deserialize<TestSimpleRecord>(json, options);

        // Assert
        Assert.NotNull(record);
        Assert.Equal(2, record.Data.Count);
        Assert.Equal(1, record.Data["key1"]);
        Assert.Equal(2, record.Data["key2"]);
    }

    /// <summary>
    /// Deserializing dictionary JSON with enum keys reconstructs a record with the enum-keyed entries.
    /// </summary>
    [Fact]
    public void Deserialize_ComplexRecord_ShouldCreateRecordFromDictionaryJson()
    {
        // Arrange
        var options = CreateOptions<TestComplexRecord>();
        var json = """{"Area":["algebra","geometry"],"Technique":["induction"]}""";

        // Act
        var record = JsonSerializer.Deserialize<TestComplexRecord>(json, options);

        // Assert
        Assert.NotNull(record);
        Assert.Equal(2, record.Data.Count);
        Assert.Equal(new[] { "algebra", "geometry" }, record.Data[TestTagCategory.Area]);
        Assert.Equal(new[] { "induction" }, record.Data[TestTagCategory.Technique]);
    }

    /// <summary>
    /// Deserializing nested dictionary JSON reconstructs a record with the nested dictionaries.
    /// </summary>
    [Fact]
    public void Deserialize_NestedRecord_ShouldCreateRecordFromDictionaryJson()
    {
        // Arrange
        var options = CreateOptions<TestNestedRecord>();
        var json = """{"outer1":{"1":true,"2":false},"outer2":{"3":true}}""";

        // Act
        var record = JsonSerializer.Deserialize<TestNestedRecord>(json, options);

        // Assert
        Assert.NotNull(record);
        Assert.Equal(2, record.Data.Count);
        Assert.Equal(2, record.Data["outer1"].Count);
        Assert.True(record.Data["outer1"][1]);
        Assert.False(record.Data["outer1"][2]);
        Assert.Equal(1, record.Data["outer2"].Count);
        Assert.True(record.Data["outer2"][3]);
    }

    /// <summary>
    /// Deserializing a JSON null yields a null record.
    /// </summary>
    [Fact]
    public void Deserialize_NullJson_ShouldReturnNull()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var json = "null";

        // Act
        var record = JsonSerializer.Deserialize<TestSimpleRecord>(json, options);

        // Assert
        Assert.Null(record);
    }

    /// <summary>
    /// Deserializing an empty JSON object yields a record with an empty dictionary.
    /// </summary>
    [Fact]
    public void Deserialize_EmptyDictionary_ShouldCreateRecordWithEmptyData()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var json = "{}";

        // Act
        var record = JsonSerializer.Deserialize<TestSimpleRecord>(json, options);

        // Assert
        Assert.NotNull(record);
        Assert.Empty(record.Data);
    }

    #endregion

    #region Round-trip Tests

    /// <summary>
    /// Serializing then deserializing a simple record preserves its dictionary data.
    /// </summary>
    [Fact]
    public void RoundTrip_SimpleRecord_ShouldPreserveData()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var originalRecord = new TestSimpleRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create("key1", 1),
                KeyValuePair.Create("key2", 2)
            ]));

        // Act
        var json = JsonSerializer.Serialize(originalRecord, options);
        var deserializedRecord = JsonSerializer.Deserialize<TestSimpleRecord>(json, options);

        // Assert
        Assert.NotNull(deserializedRecord);
        Assert.Equal(originalRecord.Data, deserializedRecord.Data);
    }

    /// <summary>
    /// Serializing then deserializing an enum-keyed record preserves its dictionary data.
    /// </summary>
    [Fact]
    public void RoundTrip_ComplexRecord_ShouldPreserveData()
    {
        // Arrange
        var options = CreateOptions<TestComplexRecord>();
        var originalRecord = new TestComplexRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create(TestTagCategory.Area, new[] { "algebra", "geometry" }),
                KeyValuePair.Create(TestTagCategory.Technique, new[] { "induction" })
            ]));

        // Act
        var json = JsonSerializer.Serialize(originalRecord, options);
        var deserializedRecord = JsonSerializer.Deserialize<TestComplexRecord>(json, options);

        // Assert
        Assert.NotNull(deserializedRecord);
        Assert.Equal(originalRecord.Data, deserializedRecord.Data);
    }

    #endregion

    #region Error Handling Tests

    /// <summary>
    /// Constructing the converter for a record with no dictionary property throws.
    /// </summary>
    [Fact]
    public void Constructor_RecordWithoutDictionaryProperty_ShouldThrowException()
    {
        // Arrange & Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithoutDictionary>());
    }

    /// <summary>
    /// Constructing the converter for a record with more than one dictionary property throws.
    /// </summary>
    [Fact]
    public void Constructor_RecordWithMultipleDictionaryProperties_ShouldThrowException()
    {
        // Arrange & Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithMultipleDictionaries>());
    }

    /// <summary>
    /// Constructing the converter for a record lacking a constructor that takes the dictionary throws.
    /// </summary>
    [Fact]
    public void Constructor_RecordWithoutMatchingConstructor_ShouldThrowException()
    {
        // Arrange & Act & Assert
        // The converter should fail during construction because it can't find a suitable constructor
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithoutConstructor>());
    }

    /// <summary>
    /// Deserializing JSON that doesn't match the wrapped dictionary's shape throws a JsonException.
    /// </summary>
    [Fact]
    public void Deserialize_InvalidJson_ShouldThrowJsonException()
    {
        // Arrange
        var options = CreateOptions<TestSimpleRecord>();
        var json = """{"invalid": "json"}""";

        // Act & Assert
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<TestSimpleRecord>(json, options));
    }

    #endregion

    #region Test Helper Types

    /// <summary>
    /// Test record that doesn't have a <see cref="ImmutableDictionary{TKey, TValue}"/> property
    /// </summary>
    private record TestRecordWithoutDictionary(string Name, int Value);

    /// <summary>
    /// Test record with multiple <see cref="ImmutableDictionary{TKey, TValue}"/> properties
    /// </summary>
    private record TestRecordWithMultipleDictionaries(
        ImmutableDictionary<string, int> Data1,
        ImmutableDictionary<string, string> Data2);

    /// <summary>
    /// Test record without a constructor that takes the <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    private record TestRecordWithoutConstructor
    {
        /// <summary>
        /// The dictionary the converter would target — but no constructor accepts it, so it stays empty.
        /// </summary>
        public ImmutableDictionary<string, int> Data { get; }

        // Only this constructor exists - it doesn't take the dictionary parameter.
        // ReSharper disable once UnusedParameter.Local
        public TestRecordWithoutConstructor(string _)
        {
            Data = [];
        }

        // No parameterless constructor that could be used by the converter
    }

    #endregion
}
