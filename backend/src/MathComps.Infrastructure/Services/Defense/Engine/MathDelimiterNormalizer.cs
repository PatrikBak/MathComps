using System.Text.RegularExpressions;

namespace MathComps.Infrastructure.Services.Defense.Engine;

/// <summary>
/// Rewrites LaTeX's bracket math delimiters to the dollar form. Math on MathComps is written <c>$…$</c> and
/// <c>$$…$$</c>, models reach for <c>\(…\)</c> and <c>\[…\]</c> out of habit, and a formula that keeps the brackets
/// shows up as its own source, backslashes and all.
/// </summary>
public static class MathDelimiterNormalizer
{
    /// <summary>
    /// Matches an inline <c>\(…\)</c> formula. Both delimiters must carry an unescaped backslash, and the body is
    /// lazy so consecutive formulas on one line stay separate.
    /// </summary>
    private static readonly Regex _inlinePattern = new(
        @"(?<!\\)\\\((.*?)(?<!\\)\\\)", RegexOptions.Singleline | RegexOptions.Compiled);

    /// <summary>
    /// Matches a display <c>\[…\]</c> formula, spanning newlines. The unescaped-backslash requirement is what keeps
    /// <c>\\[6pt]</c> — a row break with spacing inside an <c>aligned</c> or <c>array</c> body — from reading as an
    /// opening delimiter.
    /// </summary>
    private static readonly Regex _displayPattern = new(
        @"(?<!\\)\\\[(.*?)(?<!\\)\\\]", RegexOptions.Singleline | RegexOptions.Compiled);

    /// <summary>
    /// Normalizes every bracket-delimited formula in a piece of text to the dollar form, leaving a delimiter that
    /// never finds its partner untouched.
    /// </summary>
    /// <param name="text">The text to normalize.</param>
    /// <returns>The text with every complete <c>\(…\)</c> and <c>\[…\]</c> rewritten in dollars.</returns>
    public static string Normalize(string text)
    {
        // Display first, so a `\[` opener is never mistaken for part of an inline formula's body.
        var normalized = _displayPattern.Replace(text, match => $"$${match.Groups[1].Value}$$");

        // Then inline, over what the display pass left.
        return _inlinePattern.Replace(normalized, match => $"${match.Groups[1].Value}$");
    }
}
