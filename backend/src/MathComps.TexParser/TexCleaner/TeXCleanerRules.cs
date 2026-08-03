using System.Collections.Immutable;
using System.Text.RegularExpressions;
using MathComps.Shared.Extensions;

namespace MathComps.TexParser.TexCleaner;

/// <summary>
/// Defines a set of rules for cleaning and preprocessing raw TeX content written in one language.
/// Specifies patterns to remove, substitutions to perform, and a list of known macros to ignore
/// when checking for unknown commands.
/// </summary>
/// <param name="RemoveRegexes">A set of regular expressions that match content to be completely removed from the TeX source.</param>
/// <param name="Substitutions">An ordered list of pattern-replacement pairs to be applied to the TeX source,
/// those written in the document's own language running last.</param>
/// <param name="KnownMacros">A set of TeX command names (without the backslash) that the parser should recognize as valid.</param>
public record TeXCleanerRules(
    ImmutableHashSet<Regex> RemoveRegexes,
    ImmutableList<(Regex Pattern, string Replacement)> Substitutions,
    ImmutableHashSet<string> KnownMacros
)
{
    /// <summary>
    /// The shape of a header opening the substitutions of a single language, its two-letter code
    /// following the shared section's name.
    /// </summary>
    private static readonly Regex _localeSubstituteHeaderPattern = new(@"^\[substitute:(?<locale>[a-z]{2})\]$");

    /// <summary>
    /// Loads and parses the rules file that sits next to this source file, for one language.
    /// The file supports the sections [leave], [remove], [substitute], and a [substitute:xx] per
    /// language, holding the substitutions whose replacement is worded in that language.
    /// Lines are regexes; substitutions use the form:  PATTERN => REPLACEMENT
    /// Blank lines and lines starting with '#' are ignored.
    /// </summary>
    /// <param name="locale">The two-letter code of the language the document being cleaned is written in.</param>
    /// <returns>The shared rules, with the language's own substitutions appended to them.</returns>
    public static TeXCleanerRules LoadRules(string locale)
    {
        // Define containers for the three language-independent rule groups.
        var remove = new List<Regex>();
        var subs = new List<(Regex, string)>();
        var leave = new List<string>();

        // The substitutions each language declares for itself, keyed by its two-letter code.
        var localizedSubs = new Dictionary<string, List<(Regex Pattern, string Replacement)>>();

        // Track the current section; defaults to none until a header is seen.
        var currentSection = "";

        // The language a [substitute:xx] section belongs to, null while inside any other section.
        string? currentSectionLocale = null;

        // Define constant strings for the section headers.
        const string LeaveHeader = "[leave]";
        const string RemoveHeader = "[remove]";
        const string SubstituteHeader = "[substitute]";

        // Get the path to the rules file in the same directory as this source file
        var rulesFilePath = Path.Combine(AppContext.BaseDirectory, "TexCleaner", "tex_cleaner_rules.txt");

        // Iterate over all lines and route them into the correct section.
        foreach (var rawLine in File.ReadAllLines(rulesFilePath))
        {
            // Trim just the start, the end might have important spaces.
            var line = rawLine.TrimStart();

            // Skip empty lines and comments.
            if (line is "" || line.StartsWith('#'))
                continue;

            // A language-scoped substitution header names the language it speaks for.
            var localeHeaderMatch = _localeSubstituteHeaderPattern.Match(line);

            // When one is encountered, its rules join that language's own list.
            if (localeHeaderMatch.Success)
            {
                // Read the rest of the section as substitutions...
                currentSection = SubstituteHeader;

                // ...belonging to this language.
                currentSectionLocale = localeHeaderMatch.Groups["locale"].Value;
                continue;
            }

            // When a language-independent header is encountered.
            if (line is LeaveHeader or RemoveHeader or SubstituteHeader)
            {
                // Switch sections.
                currentSection = line;

                // Nothing that follows belongs to a single language.
                currentSectionLocale = null;
                continue;
            }

            // Based on the current section, compile regexes or parse substitutions.
            switch (currentSection)
            {
                case LeaveHeader:
                    leave.Add(line);
                    break;

                case RemoveHeader:
                    remove.Add(new Regex(line));
                    break;

                case SubstituteHeader:
                    // Expect the form  PATTERN => REPLACEMENT
                    var parts = line.Split([" => "], StringSplitOptions.None);
                    if (parts.Length != 2)
                        throw new InvalidOperationException($"Invalid substitution rule: '{line}'. Use 'PATTERN => REPLACEMENT'.");

                    // Compile the pattern and store the pair.
                    var pattern = new Regex(parts[0]);
                    var replacement = parts[1];

                    // A rule that names no language applies to all of them.
                    if (currentSectionLocale is null)
                    {
                        // Record it among the shared ones.
                        subs.Add((pattern, replacement));
                        break;
                    }

                    // Otherwise it belongs to its own language's list, opened when its first rule is read.
                    if (!localizedSubs.TryGetValue(currentSectionLocale, out var languageSubs))
                        localizedSubs[currentSectionLocale] = languageSubs = [];

                    // Record the substitution there.
                    languageSubs.Add((pattern, replacement));
                    break;

                default:
                    throw new InvalidOperationException($"Rules file error: line outside any section: '{line}'");
            }
        }

        // A language's captions come from its own section, so one without a section cannot be cleaned.
        if (!localizedSubs.TryGetValue(locale, out var localeSubs))
            throw new InvalidOperationException(
                $"The rules file has no [substitute:{locale}] section. Every language needs one, holding the "
                + "same patterns as the others with its own wording as the replacement.");

        // The patterns this language declares, which every other language's section has to match too, so
        // that a rule added for one of them cannot be forgotten in another.
        var referencePatterns = localeSubs.Select(sub => sub.Pattern.ToString()).ToList();

        // Gather every language that declares a different set of patterns, or the same set in a different order.
        var divergentLocales = localizedSubs
            .Where(entry => !entry.Value.Select(sub => sub.Pattern.ToString()).SequenceEqual(referencePatterns))
            .Select(entry => entry.Key)
            .ToList();

        // Name them all, since any one of them may be the section that was missed.
        if (divergentLocales.Count > 0)
            throw new InvalidOperationException(
                $"The rules file's [substitute:{locale}] section declares different patterns than "
                + $"{divergentLocales.Select(code => $"[substitute:{code}]").ToJoinedString()}. "
                + "Every language must declare the same ones, in the same order.");

        // Build an immutable configuration instance, the language's own substitutions running last.
        return new(
            RemoveRegexes: [.. remove],
            Substitutions: [.. subs, .. localeSubs],
            KnownMacros: [.. leave]
        );
    }

    /// <summary>
    /// Applies removals and substitutions to the raw string before any parsing occurs.
    /// </summary>
    /// <param name="text">The original string.</param>
    /// <returns>The transformed string.</returns>
    public string ApplyToRawTex(string text)
    {
        // Remove all matches of every removal regex.
        foreach (var pattern in RemoveRegexes)
            text = pattern.Replace(text, "");

        // Apply all substitutions in the specified order.
        foreach (var (pattern, replacement) in Substitutions)
            text = pattern.Replace(text, replacement);

        // Return the modified text.
        return text;
    }
}
