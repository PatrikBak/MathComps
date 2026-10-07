using System.Collections.Immutable;
using MathComps.Domain.Localization;
using MathComps.Domain.Resources;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Shared.Io;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Tests.Localization;

/// <summary>
/// Checks on the copy files as people edit them by hand.
/// </summary>
public class LocalizedCopyTests
{
    /// <summary>
    /// Every language's file holds every line any of them does, so a line one language lacks fails here and not the
    /// first time it is written out in that language.
    /// </summary>
    [Fact]
    public void Every_language_has_every_line()
    {
        // The paths of each language's lines
        var lines = Enum.GetValues<Language>().ToDictionary(language => language, language => Lines(language).Keys);

        // Every line any language has
        var everyKey = lines.Values.SelectMany(languageKeys => languageKeys).ToHashSet();

        // The lines a language lacks, each named with its language
        var failures = lines
            .SelectMany(pair => everyKey.Except(pair.Value).Select(key => $"{pair.Key}: no {key}"))
            .ToList();

        // No language lacks a line
        Assert.Empty(failures);
    }

    /// <summary>
    /// The examiner's opener comes out in every language exactly as its file has it, the way every defense writes it
    /// out. The formatter every line goes through fills braces and reads apostrophes as quotes, so a brace or a
    /// doubled apostrophe typed into one language's opener, say around LaTeX, fails here and not at the first defense
    /// in it.
    /// </summary>
    [Fact]
    public void The_opener_comes_out_as_written_in_every_language()
    {
        // The languages whose opener the formatter refuses or changes, each with what went wrong
        var failures = Enum.GetValues<Language>()
            .Select(language => Record.Exception(() => Assert.Equal(
                    Lines(language)["defense.opener"], IDefenseSessionService.Opener(language))) is { } exception
                ? $"{language}: {exception.Message}"
                : null)
            .OfType<string>()
            .ToList();

        // Every language's opener comes out as written
        Assert.Empty(failures);
    }

    /// <summary>
    /// Reads one language's copy file as it is written.
    /// </summary>
    /// <param name="language">The language.</param>
    /// <returns>Each line by its path through the file.</returns>
    private static ImmutableDictionary<string, string> Lines(Language language) =>
        // The file, read raw
        FileUtilities.ReadAppFile(ResourcePaths.Copy(language)).FlattenJson();
}
