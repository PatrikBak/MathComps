using System.Collections.Immutable;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Dtos;

public class SimpleTagsByCategoryConverter : JsonConverter<SimpleTagsByCategory>
{
    public override SimpleTagsByCategory? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    => new(JsonSerializer.Deserialize<ImmutableDictionary<TagType, string[]>>(
        ref reader, options) ?? throw new Exception("couldn't parse as json"));

    public override void Write(Utf8JsonWriter writer, SimpleTagsByCategory value, JsonSerializerOptions options)
    => JsonSerializer.Serialize(writer, value.Data, options);
}

[JsonConverter(typeof(SimpleTagsByCategoryConverter))]
public record SimpleTagsByCategory(ImmutableDictionary<TagType, string[]> Data)
{
    public ImmutableDictionary<string, TagType> ToDict()
        => Data.SelectMany(kv => kv.Value.ToImmutableDictionary(tag => tag, tag => kv.Key)).ToImmutableDictionary();

    public string ToJson()
    {
        return JsonSerializer.Serialize(Data, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
    }

    public SimpleTagsByCategory Filter(
        ImmutableDictionary<string, bool> approvals,
        out HashSet<string> unmatchedApprovals,
        out HashSet<string> unmatchedCandidates)
    {
        var result = new Dictionary<TagType, List<string>>();
        unmatchedApprovals = [.. approvals.Keys];
        unmatchedCandidates = [];
        foreach (var kv in Data)
        {
            if (!result.ContainsKey(kv.Key))
            {
                result[kv.Key] = [];
            }
            foreach (var tag in kv.Value)
            {
                if (approvals.TryGetValue(tag, out var approved))
                {
                    unmatchedApprovals.Remove(tag);
                    if (approved)
                    {
                        result[kv.Key].Add(tag);
                    }
                }
                else
                {
                    unmatchedCandidates.Add(tag);
                }
            }
        }
        return new SimpleTagsByCategory(result.ToImmutableDictionary(kv => kv.Key, kv => kv.Value.ToArray()));
    }
}

public class TagsByCategoryConverter : JsonConverter<TagsByCategory>
{
    public override TagsByCategory? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    => new(JsonSerializer.Deserialize<ImmutableDictionary<TagType, ImmutableDictionary<string, string>>>(
        ref reader, options) ?? throw new Exception("couldn't parse as json"));

    public override void Write(Utf8JsonWriter writer, TagsByCategory value, JsonSerializerOptions options)
    => JsonSerializer.Serialize(writer, value.Data, options);
}

[JsonConverter(typeof(TagsByCategoryConverter))]
public record TagsByCategory(ImmutableDictionary<TagType, ImmutableDictionary<string, string>> Data)
{
    public ImmutableDictionary<string, (TagType Type, string Description)> ToDict()
        => Data.SelectMany(kv => kv.Value.ToImmutableDictionary(kv2 => kv2.Key, kv2 => (kv.Key, kv2.Value)))
        .ToImmutableDictionary();

    public SimpleTagsByCategory Simple() => new(Data.ToImmutableDictionary(kv => kv.Key, kv => kv.Value.Keys.ToArray()));

    public string ToJson()
    {
        return JsonSerializer.Serialize(Data, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
    }
}

public record TagApprovalDecision(
    [property: JsonPropertyName("approved")] bool Approved,
    [property: JsonPropertyName("reason")] string Reason);

public record TagFitness(
    [property: JsonPropertyName("goodnessOfFit")] float GoodnessOfFit,
    [property: JsonPropertyName("justification")] string Justification);