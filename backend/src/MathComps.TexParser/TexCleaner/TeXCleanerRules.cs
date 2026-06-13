using System.Collections.Immutable;
using System.Text.RegularExpressions;

namespace MathComps.TexParser.TexCleaner;

/// <summary>
/// Defines a set of rules for cleaning and preprocessing raw TeX content. Specifies
/// patterns to remove, substitutions to perform, and a list of known macros to ignore
/// when checking for unknown commands.
/// </summary>
/// <param name="RemoveRegexes">A set of regular expressions that match content to be completely removed from the TeX source.</param>
/// <param name="Substitutions">An ordered list of pattern-replacement pairs to be applied to the TeX source.</param>
/// <param name="KnownMacros">A set of TeX command names (without the backslash) that the parser should recognize as valid.</param>
public record TeXCleanerRules(
    ImmutableHashSet<Regex> RemoveRegexes,
    ImmutableList<(Regex Pattern, string Replacement)> Substitutions,
    ImmutableHashSet<string> KnownMacros
)
{
    /// <summary>
    /// Loads and parses a .rules.txt file placed next to the input .tex file.
    /// The file supports three sections: [leave], [remove], [substitute].
    /// Lines are regexes; substitutions use the form:  PATTERN => REPLACEMENT
    /// Blank lines and lines starting with '#' are ignored. The rules are loaded
    /// from the file next to this source file.
    /// </summary>
    public static TeXCleanerRules LoadRules()
    {
        // Define containers for the three rule groups.
        var remove = new List<Regex>();
        var subs = new List<(Regex, string)>();
        var leave = new List<string>();

        // Track the current section; defaults to none until a header is seen.
        var currentSection = "";

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

            // When a known header is encountered.
            if (line is LeaveHeader or RemoveHeader or SubstituteHeader)
            {
                // Switch sections.
                currentSection = line;
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

                    // Record the substitution.
                    subs.Add((pattern, replacement));
                    break;

                default:
                    throw new InvalidOperationException($"Rules file error: line outside any section: '{line}'");
            }
        }

        // Build an immutable configuration instance.
        return new(
            RemoveRegexes: [.. remove],
            Substitutions: [.. subs],
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
