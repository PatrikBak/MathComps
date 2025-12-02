using System.Text.Json;
using MathComps.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Svix;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for processing webhook events.
/// </summary>
/// <param name="clerkSettings">The Clerk settings.</param>
/// <param name="userManager">The service that handles user syncing.</param>
/// <param name="logger">The logger.</param>
public class ClerkWebhook(
    IOptions<ClerkSettings> clerkSettings,
    IUserManager userManager,
    ILogger<ClerkWebhook> logger) : IClerkWebhookService
{
    /// <summary>
    /// Processes a Clerk webhook event.
    /// </summary>
    /// <param name="payload">The raw JSON payload from the webhook.</param>
    /// <param name="headers">The request headers containing Svix signature information.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>A result indicating the outcome of webhook processing.</returns>
    public async Task<WebhookResult> ProcessClerkWebhookAsync(
        string payload,
        System.Net.WebHeaderCollection headers,
        CancellationToken cancellationToken = default)
    {
        // Validate webhook secret configuration.
        if (string.IsNullOrEmpty(clerkSettings.Value.WebhookSecret))
            return new WebhookResult(false, 500, "Webhook secret not configured");

        try
        {
            // Verify signature
            new Webhook(clerkSettings.Value.WebhookSecret).Verify(payload, headers);
        }
        catch (Exception)
        {
            // This would be real sus
            return new WebhookResult(false, 400, "Invalid signature");
        }

        try
        {
            // Parse and handle event
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();
            var data = root.GetProperty("data");

            // Extract user ID, should be present in all hook we handle
            var clerkId = data.GetProperty("id").GetString()
                ?? throw new ArgumentException("User ID is missing.");

            switch (type)
            {
                // Upsert needed
                case "user.created":
                case "user.updated":
                    // Extract email address (assuming the first one is primary/relevant).
                    var email = data.TryGetProperty("email_addresses", out var array)
                        && array.GetArrayLength() > 0
                        && array[0].TryGetProperty("email_address", out var emailProperty)
                        ? emailProperty.GetString()
                        : null;

                    // Extract names
                    var firstName = data.GetProperty("first_name").GetString();
                    var lastName = data.GetProperty("last_name").GetString();

                    // Create DTO for synchronization.
                    var userDto = new UserSyncDto(clerkId, email, firstName, lastName);

                    // Delegate synchronization to the user manager.
                    await userManager.SyncUserAsync(userDto, cancellationToken);
                    break;

                // Delete needed
                case "user.deleted":
                    // Delegate deletion to the user manager.
                    await userManager.DeleteUserAsync(clerkId, cancellationToken);
                    break;

                // Unhandled events, might come if Clerk's misconfigured
                default:
                    throw new NotImplementedException($"Unhandled event type: {type}");
            }

            // Happy path
            logger.LogInformation("Webhook processed successfully");
            return new WebhookResult(true, 200);
        }
        catch (Exception exception)
        {
            // Sad path
            logger.LogError(exception, "Webhook processing failed");
            return new WebhookResult(false, 500, exception.Message);
        }
    }
}
