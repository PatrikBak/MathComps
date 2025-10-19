using System.Collections.Immutable;
using System.Text.Json;
using System.Text.Json.Serialization;
using MathComps.Shared.Converters;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Shared.Tests.Converters;

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
    /// Test record that wraps a simple <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestSimpleRecord>))]
    public record TestSimpleRecord(ImmutableDictionary<string, int> Data);

    /// <summary>
    /// Test record that wraps a complex <see cref="ImmutableDictionary{TKey, TValue}"/> with <see cref="TagType"/> enum keys
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestComplexRecord>))]
    public record TestComplexRecord(ImmutableDictionary<TagType, string[]> Data);

    /// <summary>
    /// Test record that wraps a nested <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    [JsonConverter(typeof(GenericDictionaryWrapperConverter<TestNestedRecord>))]
    public record TestNestedRecord(ImmutableDictionary<string, ImmutableDictionary<int, bool>> Data);

    #endregion

    #region Serialization Tests

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

    [Fact]
    public void Serialize_ComplexRecord_ShouldSerializeOnlyDictionaryData()
    {
        // Arrange
        var options = CreateOptions<TestComplexRecord>();

        var record = new TestComplexRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create(TagType.Area, new[] { "algebra", "geometry" }),
                KeyValuePair.Create(TagType.Technique, new[] { "induction" })
            ]));

        // Act
        var json = JsonSerializer.Serialize(record, options);

        // Assert
        // Note: Enum serialization uses string names by default, and dictionary order may vary
        Assert.Contains("\"Area\":[\"algebra\",\"geometry\"]", json);
        Assert.Contains("\"Technique\":[\"induction\"]", json);
    }

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
        Assert.Equal(new[] { "algebra", "geometry" }, record.Data[TagType.Area]);
        Assert.Equal(new[] { "induction" }, record.Data[TagType.Technique]);
    }

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

    [Fact]
    public void RoundTrip_ComplexRecord_ShouldPreserveData()
    {
        // Arrange
        var options = CreateOptions<TestComplexRecord>();
        var originalRecord = new TestComplexRecord(
            ImmutableDictionary.CreateRange([
                KeyValuePair.Create(TagType.Area, new[] { "algebra", "geometry" }),
                KeyValuePair.Create(TagType.Technique, new[] { "induction" })
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

    [Fact]
    public void Constructor_RecordWithoutDictionaryProperty_ShouldThrowException()
    {
        // Arrange & Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithoutDictionary>());
    }

    [Fact]
    public void Constructor_RecordWithMultipleDictionaryProperties_ShouldThrowException()
    {
        // Arrange & Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithMultipleDictionaries>());
    }

    [Fact]
    public void Constructor_RecordWithoutMatchingConstructor_ShouldThrowException()
    {
        // Arrange & Act & Assert
        // The converter should fail during construction because it can't find a suitable constructor
        Assert.Throws<InvalidOperationException>(() =>
            new GenericDictionaryWrapperConverter<TestRecordWithoutConstructor>());
    }

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
    public record TestRecordWithoutDictionary(string Name, int Value);

    /// <summary>
    /// Test record with multiple <see cref="ImmutableDictionary{TKey, TValue}"/> properties
    /// </summary>
    public record TestRecordWithMultipleDictionaries(
        ImmutableDictionary<string, int> Data1,
        ImmutableDictionary<string, string> Data2);

    /// <summary>
    /// Test record without a constructor that takes the <see cref="ImmutableDictionary{TKey, TValue}"/>
    /// </summary>
    public record TestRecordWithoutConstructor
    {
        public ImmutableDictionary<string, int> Data { get; }

        // Only this constructor exists - it doesn't take the dictionary parameter
        public TestRecordWithoutConstructor(string _)
        {
            Data = ImmutableDictionary<string, int>.Empty;
        }

        // No parameterless constructor that could be used by the converter
    }

    #endregion
}
