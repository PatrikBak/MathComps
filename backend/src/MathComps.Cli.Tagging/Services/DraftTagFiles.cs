using System.Collections.Immutable;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MathComps.Shared.Cli;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// One slug destined for a draft's <c>tags:</c> list, with the model's fitness and optional justification rendered
/// as a trailing review comment.
/// </summary>
/// <param name="Slug">The canonical slug.</param>
/// <param name="Fitness">The generate pass's goodness-of-fit score (0–1), shown at the head of the comment.</param>
/// <param name="Justification">The generate pass's reason, shown after the fitness; null/blank shows the fitness alone.</param>
public record DraftTag(string Slug, float Fitness, string? Justification);

/// <summary>
/// The original-language body and yaml sidecar of one draft problem.
/// </summary>
/// <param name="Index">The 1-based problem number from the <c>pN</c> filename.</param>
/// <param name="BodyPath">Absolute path to the original-language <c>pN.&lt;lang&gt;.md</c> body.</param>
/// <param name="YamlPath">Absolute path to the <c>pN.yaml</c> sidecar (which may not exist yet).</param>
public record DraftProblemFiles(int Index, string BodyPath, string YamlPath);

/// <summary>
/// Reads and writes the draft files that <c>tag-draft</c> touches — discovering problems, splitting a body into
/// statement and solution, and appending a <c>tags:</c> block to a sidecar without disturbing its other keys. The
/// string-to-string helpers are pure so the body split, the skip rule, and the block formatting are unit-testable.
/// </summary>
public static class DraftTagFiles
{
    /// <summary>
    /// The standalone comment line that separates a body's statement from its solution. Matches the bulk-import
    /// preflight's sentinel so both sides split a body identically.
    /// </summary>
    public const string SolutionSentinel = "<!-- solution -->";

    /// <summary>
    /// Splits a problem body into its statement and solution halves on the solution sentinel.
    /// </summary>
    /// <param name="body">The full body file contents.</param>
    /// <returns>The statement, and the solution — null when there is no sentinel or the solution half is blank.</returns>
    public static (string Statement, string? Solution) SplitStatementAndSolution(string body)
    {
        // Work line by line, normalizing CRLF so the sentinel match is exact.
        var lines = body.Replace("\r\n", "\n").Split('\n');

        // Find the solution sentinel.
        var sentinelIndex = Array.FindIndex(lines, line => line.Trim() == SolutionSentinel);

        // Without it, the whole body is the statement.
        if (sentinelIndex == -1)
            return (body.Trim(), null);

        // Statement is everything above the sentinel; solution everything below it.
        var statement = string.Join('\n', lines.Take(sentinelIndex)).Trim();
        var solution = string.Join('\n', lines.Skip(sentinelIndex + 1)).Trim();

        // A sentinel with nothing meaningful under it counts as no solution.
        return (statement, solution.Length == 0 ? null : solution);
    }

    /// <summary>
    /// Whether a sidecar's yaml already declares a top-level <c>tags:</c> key — the skip rule's signal that a problem
    /// has already been tagged (an empty list counts as "decided: no tags").
    /// </summary>
    /// <param name="yamlText">The sidecar's contents.</param>
    /// <returns><c>true</c> if a <c>tags</c> key is present.</returns>
    public static bool HasTagsKey(string yamlText)
    {
        // An empty sidecar declares nothing.
        if (string.IsNullOrWhiteSpace(yamlText))
            return false;

        // Parse the mapping and look for the key.
        return yamlText.FromYaml<Dictionary<string, object>>().ContainsKey("tags");
    }

    /// <summary>
    /// Renders a <c>tags:</c> block: a bare slug list, each line trailed by a comment carrying the model's fitness and
    /// its justification. An empty set renders as <c>tags: []</c> so the skip rule sees the problem as decided.
    /// </summary>
    /// <param name="tags">The slugs to write, in the order they should appear.</param>
    /// <returns>The yaml block, without a trailing newline.</returns>
    public static string BuildTagsBlock(IReadOnlyList<DraftTag> tags)
    {
        // No tags survived — record the decision explicitly.
        if (tags.Count == 0)
            return "tags: []";

        // Start with the header.
        var builder = new StringBuilder("tags:");

        // Append one indented list item per slug.
        foreach (var tag in tags)
        {
            // Render the fitness locale-independently, with one or two decimals.
            var fitness = tag.Fitness.ToString("0.0#", CultureInfo.InvariantCulture);

            // Lead the comment with the fitness, then the justification when there is one.
            var justification = SanitizeComment(tag.Justification);
            var comment = justification is null ? $"fit {fitness}" : $"fit {fitness} — {justification}";

            // Write the slug as a list item trailed by the comment.
            builder.Append("\n  - ").Append(tag.Slug).Append(" # ").Append(comment);
        }

        // The assembled block.
        return builder.ToString();
    }

    /// <summary>
    /// Appends a <c>tags:</c> block below a sidecar's existing keys, preserving them verbatim.
    /// </summary>
    /// <param name="existingYaml">The sidecar's current contents (empty when the file does not exist yet).</param>
    /// <param name="tagsBlock">The block produced by <see cref="BuildTagsBlock"/>.</param>
    /// <returns>The full sidecar contents to write back, newline-terminated.</returns>
    public static string AppendTagsBlock(string existingYaml, string tagsBlock)
    {
        // With no prior content the block stands alone.
        if (string.IsNullOrWhiteSpace(existingYaml))
            return EnsureTrailingNewline(tagsBlock);

        // Otherwise keep the existing keys and append the block beneath them.
        return EnsureTrailingNewline(EnsureTrailingNewline(existingYaml) + tagsBlock);
    }

    /// <summary>
    /// Reads the draft's original language from <c>_meta.yaml</c> — the language whose body files <c>tag-draft</c>
    /// sends to the model.
    /// </summary>
    /// <param name="folder">The draft folder.</param>
    /// <returns>The lowercase locale code (e.g. <c>sk</c>).</returns>
    public static string ReadOriginalLanguage(string folder)
    {
        // Parse the folder-level metadata.
        var metaPath = Path.Combine(folder, "_meta.yaml");
        var mapping = File.ReadAllText(metaPath).FromYaml<Dictionary<string, object>>();

        // Pull the language field, failing when it's absent, and normalize it.
        return !mapping.TryGetValue("language", out var language) || language is null
            ? throw new InvalidOperationException($"'{metaPath}' is missing the 'language' field.")
            : language.ToString()!.Trim().ToLowerInvariant();
    }

    /// <summary>
    /// Discovers the draft's problems by their original-language body files, in ascending problem order.
    /// </summary>
    /// <param name="folder">The draft folder.</param>
    /// <param name="language">The original language code from <see cref="ReadOriginalLanguage"/>.</param>
    /// <returns>The problems' body and sidecar paths.</returns>
    public static ImmutableArray<DraftProblemFiles> DiscoverProblems(string folder, string language)
    {
        // Body files are named pN.<lang>.md; capture the problem number from each.
        var pattern = new Regex($@"^p(\d+)\.{Regex.Escape(language)}\.md$", RegexOptions.IgnoreCase);

        // Match each original-language body, derive its sidecar, and order by problem number.
        return [.. Directory.EnumerateFiles(folder, $"p*.{language}.md")
            .Select(path => (Path: path, Match: pattern.Match(Path.GetFileName(path))))
            .Where(entry => entry.Match.Success)
            .Select(entry =>
            {
                // Derive the sidecar path from the problem number.
                var index = int.Parse(entry.Match.Groups[1].Value);
                var yamlPath = Path.Combine(folder, $"p{index}.yaml");
                return new DraftProblemFiles(index, entry.Path, yamlPath);
            })
            .OrderBy(problem => problem.Index)];
    }

    /// <summary>
    /// Collapses a justification into a single-line yaml comment, returning null when there is nothing to show.
    /// </summary>
    /// <param name="justification">The raw justification.</param>
    /// <returns>A single-line comment, or null when blank.</returns>
    private static string? SanitizeComment(string? justification)
    {
        // Nothing to render.
        if (string.IsNullOrWhiteSpace(justification))
            return null;

        // Fold any newlines into spaces and squeeze runs of whitespace so the comment stays on one line.
        var collapsed = Regex.Replace(justification.Trim(), @"\s+", " ");

        // Treat an all-whitespace justification as nothing to show.
        return collapsed.Length == 0 ? null : collapsed;
    }

    /// <summary>
    /// Ensures a string ends with exactly one newline.
    /// </summary>
    /// <param name="text">The text to terminate.</param>
    /// <returns>The text with a single trailing newline.</returns>
    private static string EnsureTrailingNewline(string text) =>
        text.EndsWith('\n') ? text : text + "\n";
}
