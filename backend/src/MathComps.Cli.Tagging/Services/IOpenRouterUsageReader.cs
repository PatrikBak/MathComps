namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Reads spend figures for the configured OpenRouter API key.
/// </summary>
public interface IOpenRouterUsageReader
{
    /// <summary>
    /// Reads the key's all-time credits-used counter, where one credit is one US dollar.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The total credits the key has spent since it was created.</returns>
    Task<decimal> GetCreditsUsedAsync(CancellationToken cancellationToken = default);
}
