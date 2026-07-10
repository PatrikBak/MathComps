namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Runs a single structured chat completion against OpenRouter: a system message plus a user message in, a reply
/// bound to the requested response type out, with transient failures retried. Each call names the model it routes to;
/// the reasoning level is optional per call.
/// </summary>
public interface IOpenRouterChatCaller
{
    /// <summary>
    /// Sends one completion and binds the reply to <typeparamref name="TResponse"/>, retrying a few times on a
    /// transient failure — a reply that comes back malformed counts as one — before surfacing it.
    /// </summary>
    /// <typeparam name="TResponse">The structured shape the reply is bound into.</typeparam>
    /// <param name="systemPrompt">The system message: instructions and any grounding.</param>
    /// <param name="userPrompt">The user message: the input the model acts on.</param>
    /// <param name="model">The model to route this call to, in OpenRouter's <c>vendor/model</c> form.</param>
    /// <param name="reasoningEffort">The reasoning-effort level for this call, or null to send no reasoning field.</param>
    /// <param name="maxOutputTokens">A cap on the reply's output tokens, reasoning included, or null for the model's
    /// default.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The bound reply.</returns>
    Task<TResponse> CompleteAsync<TResponse>(
        string systemPrompt,
        string userPrompt,
        string model,
        string? reasoningEffort = null,
        int? maxOutputTokens = null,
        CancellationToken cancellationToken = default);
}
