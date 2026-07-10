namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// A tally of the process's own OpenRouter spend, accumulated one priced reply at a time. Summing the figures as they
/// land keeps the total exact even when other processes spend on the same key concurrently.
/// </summary>
public interface IOpenRouterSpendTracker
{
    /// <summary>
    /// The credits this process has spent so far; one credit is one US dollar.
    /// </summary>
    decimal Total { get; }

    /// <summary>
    /// Folds one reply's billed cost into the total.
    /// </summary>
    /// <param name="cost">The credits the reply cost.</param>
    void Add(decimal cost);
}
