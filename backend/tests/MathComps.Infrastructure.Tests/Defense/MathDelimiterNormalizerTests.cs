using MathComps.Infrastructure.Services.Defense.Engine;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests <see cref="MathDelimiterNormalizer"/>: the bracket delimiters a model reaches for become dollars, several
/// formulas in one message stay separate, an opener with no partner is left alone, and the <c>\\[6pt]</c> row break
/// that looks exactly like an opening delimiter survives untouched.
/// </summary>
public class MathDelimiterNormalizerTests
{
    /// <summary>
    /// Every complete bracket-delimited formula becomes its dollar equivalent, and everything else survives byte for
    /// byte.
    /// </summary>
    /// <param name="text">The text to normalize.</param>
    /// <param name="expected">What normalizing it should produce.</param>
    [Theory]
    // An inline formula and a display one, the two shapes being rewritten.
    [InlineData(@"\(x^2\)", "$x^2$")]
    [InlineData(@"\[x^2\]", "$$x^2$$")]
    // Each formula in a message is rewritten, and the prose between them is left as it stands.
    [InlineData(@"Take \(a\) and \(b\).", "Take $a$ and $b$.")]
    [InlineData(@"\[a\] then \[b\]", "$$a$$ then $$b$$")]
    // Dollar math already in the message survives alongside a converted one.
    [InlineData(@"$x$ and \(y\)", "$x$ and $y$")]
    // A display formula spans newlines.
    [InlineData("\\[\nx = 1\n\\]", "$$\nx = 1\n$$")]
    // A row break with spacing is never an opening delimiter, inside a converted formula or a dollar-delimited one.
    [InlineData(@"\[a \\[6pt] b\]", @"$$a \\[6pt] b$$")]
    [InlineData(@"$$\begin{aligned}a \\[6pt] b\end{aligned}$$", @"$$\begin{aligned}a \\[6pt] b\end{aligned}$$")]
    [InlineData(@"\\[6pt]", @"\\[6pt]")]
    // A sized delimiter ends in its own bracket, so only a backslash-led one closes a formula.
    [InlineData(@"\(\left(a+b\right)^2\)", @"$\left(a+b\right)^2$")]
    // An opener that never finds its partner stays as it is, rather than swallowing the rest of the message.
    [InlineData(@"\(x^2 and more prose", @"\(x^2 and more prose")]
    public void Bracket_delimited_formulas_become_dollar_math(string text, string expected)
    {
        // Normalize the text.
        var normalized = MathDelimiterNormalizer.Normalize(text);

        // It matches the expected rewrite exactly.
        Assert.Equal(expected, normalized);
    }
}
