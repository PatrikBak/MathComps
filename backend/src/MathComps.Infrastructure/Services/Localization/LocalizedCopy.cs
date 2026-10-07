using System.Collections.Immutable;
using System.Globalization;
using Jeffijoe.MessageFormat;
using MathComps.Domain.Localization;
using MathComps.Domain.Resources;
using MathComps.Shared.Io;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Services.Localization;

/// <summary>
/// The lines one feature writes to people in its own words, in one language. They come from
/// <see cref="ResourcePaths.Copy"/>, a file per language with a section per feature, and each line is an ICU message:
/// an argument sits in braces, and a count picks its plural form by the language's own rules.
/// </summary>
/// <param name="Language">The language the lines are written in.</param>
/// <param name="Section">The feature's section of the files.</param>
public sealed record LocalizedCopy(Language Language, string Section)
{
    /// <summary>
    /// Every language's lines, each by its path through the file, read once.
    /// </summary>
    private static readonly ImmutableDictionary<Language, ImmutableDictionary<string, string>> _lines =
        Enum.GetValues<Language>().ToImmutableDictionary(
            language => language,
            language => FileUtilities.ReadAppFile(ResourcePaths.Copy(language)).FlattenJson());

    /// <summary>
    /// The formatter every line goes through. It keeps only parsed patterns between calls, so one serves every
    /// thread.
    /// </summary>
    private static readonly MessageFormatter _formatter = new();

    /// <summary>
    /// Writes one line of the section out.
    /// </summary>
    /// <param name="key">The line's key within the section.</param>
    /// <param name="arguments">An object whose properties fill the line's arguments, by name.</param>
    /// <returns>The finished line.</returns>
    public string Format(string key, object? arguments = null)
    {
        // The line's path through the file
        var path = $"{Section}.{key}";

        // The line in the language, or a failure naming the file it is missing from
        var pattern = _lines[Language].GetValueOrDefault(path)
            ?? throw new KeyNotFoundException($"{ResourcePaths.Copy(Language)} has no '{path}'.");

        // The line with its arguments in place, plurals by the language's rules
        return _formatter.FormatMessage(
            pattern, arguments ?? new { }, CultureInfo.GetCultureInfo(Language.ToString().ToLowerInvariant()));
    }
}
