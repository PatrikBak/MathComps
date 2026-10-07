using System.Text.Json;
using MathComps.Shared.Serialization;

namespace MathComps.Shared.Tests.Serialization;

/// <summary>
/// Unit tests for <see cref="JsonExtensions.FlattenJson"/>: that a document of nested objects reads as each text
/// under its path whatever the depth, and that anything else at a leaf is refused.
/// </summary>
public class JsonExtensionsTests
{
    /// <summary>
    /// Each text comes out under the names leading down to it joined by dots, at the root, one level down and two.
    /// </summary>
    [Fact]
    public void A_document_reads_as_each_text_under_its_path_at_any_depth()
    {
        // Texts at three depths, beside an empty object with none
        const string document = /*lang=json,strict*/ """
            {
              "title": "Copy",
              "mail": { "about": "About", "privacy": "Privacy" },
              "defense": { "opener": { "short": "Hi", "long": "Hi, I'm Mathilda." } },
              "empty": {}
            }
            """;

        // The document flattened
        var texts = document.FlattenJson();

        // Every text by its path, and nothing for the empty object
        Assert.Equal(
            new Dictionary<string, string>
            {
                ["title"] = "Copy",
                ["mail.about"] = "About",
                ["mail.privacy"] = "Privacy",
                ["defense.opener.short"] = "Hi",
                ["defense.opener.long"] = "Hi, I'm Mathilda.",
            },
            texts.ToDictionary());
    }

    /// <summary>
    /// A leaf holding anything but text is refused at the read, never passed on as some text.
    /// </summary>
    /// <param name="leaf">The value at the leaf.</param>
    [Theory]
    [InlineData("""["a", "b"]""")]
    [InlineData("12")]
    [InlineData("true")]
    [InlineData("null")]
    public void A_leaf_holding_anything_but_text_is_refused(string leaf) =>
        // A document holding the leaf one level down, refused
        Assert.Throws<JsonException>(() => $$"""{ "mail": { "about": {{leaf}} } }""".FlattenJson());
}
