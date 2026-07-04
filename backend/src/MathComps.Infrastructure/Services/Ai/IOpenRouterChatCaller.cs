namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Runs a single structured chat completion against OpenRouter: a system message plus a user message in, a reply
/// bound to the requested response type out, with transient failures retried. Callers that need the same model and
/// reasoning level on every call take the configured defaults; callers that vary them per call override both.
/// </summary>
public interface IOpenRouterChatCaller
{
    /// <summary>
    /// Sends one completion and binds the reply to <typeparamref name="TResponse"/>, retrying a few times on a
    /// transient failure before surfacing it.
    /// </summary>
    /// <typeparam name="TResponse">The structured shape the reply is bound into.</typeparam>
    /// <param name="systemPrompt">The system message: instructions and any grounding.</param>
    /// <param name="userPrompt">The user message: the input the model acts on.</param>
    /// <param name="model">The model to route this call to, or null to use the configured default.</param>
    /// <param name="reasoningEffort">The reasoning-effort level for this call, or null to use the configured default.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The bound reply.</returns>
    Task<TResponse> CompleteAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string? model = null,
        string? reasoningEffort = null,
        CancellationToken cancellationToken = default);
}
