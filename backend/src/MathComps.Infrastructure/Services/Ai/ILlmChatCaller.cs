namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// Runs a single chat completion against the configured OpenAI-compatible endpoint: a system message plus a user
/// message in, the reply out (paired with what the call billed), with transient failures retried. Each call names the
/// model it routes to; the reasoning level is optional per call. A reply comes back either bound to a structured
/// shape or as plain text, and the choice matters for content — see <see cref="CompleteTextAsync"/>.
/// </summary>
public interface ILlmChatCaller
{
    /// <summary>
    /// Sends one completion and binds the reply to <typeparamref name="TResponse"/>, retrying a few times on a
    /// transient failure — a reply that comes back malformed counts as one — before surfacing it. The bound reply
    /// comes back paired with the call's billed cost and token usage.
    /// </summary>
    /// <typeparam name="TResponse">The structured shape the reply is bound into.</typeparam>
    /// <param name="request">The call's two messages, the model it routes to, and its limits.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The bound reply together with the call's billed cost and token usage.</returns>
    Task<ChatCallResult<TResponse>> CompleteAsync<TResponse>(
        ChatCallRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends one completion and takes the reply as the model's own text, retrying a few times on a transient failure —
    /// a reply that comes back blank counts as one — before surfacing it. The text comes back trimmed and paired with
    /// the call's billed cost and token usage.
    /// <para>
    /// This is the path for content the model writes backslashes in — LaTeX above all. A structured reply carries its
    /// text as a JSON string, where the model must double every backslash and reliably doesn't: <c>\text</c> and
    /// <c>\frac</c> are legal JSON escapes, so they decode to control characters and the command is gone with no error
    /// anywhere. Plain text has no second escape layer, so what the model wrote is what the caller gets.
    /// </para>
    /// </summary>
    /// <param name="request">The call's two messages, the model it routes to, and its limits.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The reply's text together with the call's billed cost and token usage.</returns>
    Task<ChatCallResult<string>> CompleteTextAsync(
        ChatCallRequest request, CancellationToken cancellationToken = default);
}
