namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// What a model call, or a run of them, billed: the spend in credits and the token counts.
/// Read off one reply's usage, and summable across the calls that make up a unit of work so a turn or a document
/// can carry a single total.
/// </summary>
/// <param name="Cost">The billed spend in credits; one credit is one US dollar (0 when the reply carried no cost).</param>
/// <param name="PromptTokens">The prompt (input) tokens, cached ones included.</param>
/// <param name="CompletionTokens">The completion (output) tokens, the reasoning ones counted among them.</param>
/// <param name="ReasoningTokens">
/// The reasoning (thinking) portion of the output, already counted within <paramref name="CompletionTokens"/> and
/// billed at the output rate; 0 when the model reports none.
/// </param>
/// <param name="CachedPromptTokens">
/// The prompt tokens served from the provider's cache at a reduced rate, a subset of
/// <paramref name="PromptTokens"/>; 0 when the model reports none.
/// </param>
public readonly record struct ModelUsage(
    decimal Cost, int PromptTokens, int CompletionTokens, int ReasoningTokens, int CachedPromptTokens)
{
    /// <summary>
    /// The empty tally: zero cost and zero tokens, the identity a running sum starts from.
    /// </summary>
    public static ModelUsage Zero => default;

    /// <summary>
    /// Sums two usages field-wise, so a loop can fold each call's usage into a running total.
    /// </summary>
    /// <param name="left">The running total so far.</param>
    /// <param name="right">The usage to add.</param>
    /// <returns>The combined spend and token counts.</returns>
    public static ModelUsage operator +(ModelUsage left, ModelUsage right)
    {
        // Add the spend and each token count field-wise.
        return new ModelUsage(
            left.Cost + right.Cost, left.PromptTokens + right.PromptTokens,
            left.CompletionTokens + right.CompletionTokens, left.ReasoningTokens + right.ReasoningTokens,
            left.CachedPromptTokens + right.CachedPromptTokens);
    }
}
