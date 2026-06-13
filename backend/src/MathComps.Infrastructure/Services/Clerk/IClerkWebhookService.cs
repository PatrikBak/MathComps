namespace MathComps.Infrastructure.Services.Clerk;

/// <summary>
/// Defines the contract for processing webhook events.
/// </summary>
public interface IClerkWebhookService
{
    /// <summary>
    /// Processes a Clerk webhook event.
    /// </summary>
    /// <param name="payload">The raw JSON payload from the webhook.</param>
    /// <param name="headers">The request headers containing Svix signature information.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A result indicating the outcome of webhook processing.</returns>
    Task<WebhookResult> ProcessClerkWebhookAsync(
        string payload,
        System.Net.WebHeaderCollection headers,
        CancellationToken cancellationToken = default);
}
