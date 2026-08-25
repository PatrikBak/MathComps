using System.Text.RegularExpressions;
using MathComps.Domain.Localization;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards the languages a language-keyed dictionary can reach the client under. The frontend reads localized
/// text as <c>Record&lt;Locale, string&gt;</c>, and neither side declares the other's list, so a language one of
/// them gains alone leaves text the other cannot index.
/// </summary>
public class LocalizedTextWireShapeTests
{
    /// <summary>
    /// The languages on the wire are exactly the locales the frontend has, so neither side can gain one without
    /// the other.
    /// </summary>
    [Fact]
    public void The_languages_match_the_frontends_locales()
    {
        // Every language the backend has, lowercased and ordered
        var languages = Enum.GetNames<Language>().Select(name => name.ToLowerInvariant()).Order();

        // The frontend's i18n source
        var source = File.ReadAllText(RepoPaths.Resolve("web", "src", "i18n", "i18n.ts"));

        // The locale list, which is the one array of quoted codes the type is built from
        var locales = Regex
            .Match(source, @"LOCALES\s*=\s*\[([^\]]*)\]")
            .Groups[1].Value;

        // Neither side may drift from the other
        Assert.Equal(
            languages,
            Regex.Matches(locales, "'([a-z]+)'")
                .Select(match => match.Groups[1].Value)
                .Order());
    }
}
