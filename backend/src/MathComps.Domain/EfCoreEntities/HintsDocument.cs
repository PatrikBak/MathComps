using System.Text.RegularExpressions;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// The shape of a <see cref="DocumentType.Hints"/> text: the author's hints in order, each opened by a sentinel line,
/// exactly as a draft body carries them. One document per language keeps the ladder inside the one-text-per-language
/// rule every other document type follows, and the sentinel is what turns it back into a list.
/// </summary>
public static partial class HintsDocument
{
    /// <summary>
    /// The line that opens one hint.
    /// </summary>
    public const string Sentinel = "<!-- hint -->";

    /// <summary>
    /// Matches a whole line holding nothing but the sentinel.
    /// </summary>
    /// <returns>The regex.</returns>
    [GeneratedRegex(@"^[ \t]*<!-- hint -->[ \t]*$", RegexOptions.Multiline)]
    private static partial Regex SentinelLine();

    /// <summary>
    /// Renders hints as one document.
    /// </summary>
    /// <param name="hints">The hints, weakest nudge first.</param>
    /// <returns>The document, or null when there are no hints to carry.</returns>
    public static string? Join(IReadOnlyList<string> hints) =>
        // No hints, no document.
        hints.Count == 0 ? null : string.Join("\n\n", hints.Select(hint => $"{Sentinel}\n\n{hint.Trim()}"));

    /// <summary>
    /// Reads the hints back out of a document.
    /// </summary>
    /// <param name="document">The document, or null for a problem with no ladder.</param>
    /// <returns>The hints, weakest nudge first; empty for no document.</returns>
    public static IReadOnlyList<string> Split(string? document) =>
        // Every hint is what sits between two sentinel lines, and what precedes the first one is blank.
        document is null
            ? []
            : [.. SentinelLine().Split(document).Select(hint => hint.Trim()).Where(hint => hint.Length > 0)];
}
