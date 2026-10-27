using System.Text.Json;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Users;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Svix;
using Svix.Exceptions;

namespace MathComps.Infrastructure.Services.Clerk;

/// <summary>
/// An <see cref="IClerkWebhookService"/> that checks each delivery's Svix signature against the configured secret,
/// then applies the user event it carries through <see cref="IUserManager"/>. Every refusal is logged at Error, since
/// Clerk retries a refused delivery and nobody else watches it fail.
/// </summary>
/// <param name="userManager">The users each event is applied to.</param>
/// <param name="logger">The logger.</param>
/// <param name="clerkSettings">The settings carrying the webhook signing secret.</param>
public class ClerkWebhook(
    IUserManager userManager,
    ILogger<ClerkWebhook> logger,
    IOptions<ClerkSettings> clerkSettings) : IClerkWebhookService
{
    /// <inheritdoc/>
    public async Task<WebhookResult> ProcessClerkWebhookAsync(
        string payload,
        System.Net.WebHeaderCollection headers,
        CancellationToken cancellationToken = default)
    {
        // Nothing can be verified without the signing secret
        if (string.IsNullOrEmpty(clerkSettings.Value.WebhookSecret))
        {
            // Every delivery fails until the secret is set, so say so
            logger.LogError("Clerk webhook refused: no webhook secret is configured");

            // Refuse the delivery, so Clerk retries it later
            return new WebhookResult(false, 500, "Webhook secret not configured");
        }

        // The delivery's id, which Clerk's webhook dashboard lists it under
        var deliveryId = headers["svix-id"];

        // Check the delivery was signed with our secret
        try
        {
            new Webhook(clerkSettings.Value.WebhookSecret).Verify(payload, headers);
        }
        catch (WebhookVerificationException exception)
        {
            // A changed signing secret refuses every delivery from here on, and nothing else would say so
            logger.LogError(exception, "Clerk webhook {DeliveryId} failed its signature check", deliveryId);

            // Refuse the delivery
            return new WebhookResult(false, 400, "Invalid signature");
        }

        // The event's type and the user it concerns, which the log lines below name
        string? type = null;
        string? clerkId = null;

        // Apply the event, where any failure refuses the delivery
        try
        {
            // The delivery's JSON
            using var document = JsonDocument.Parse(payload);

            // What kind of event it is
            type = document.RootElement.GetProperty("type").GetString();

            // The user the event is about
            var data = document.RootElement.GetProperty("data");

            // The user's Clerk id, which every event handled here carries
            clerkId = data.GetProperty("id").GetString()
                ?? throw new ArgumentException("User ID is missing.");

            // Apply the event to the stored users
            switch (type)
            {
                // A new or changed user
                case "user.created":
                case "user.updated":
                    // The account's first email address, taken as its primary one
                    var email = data.TryGetProperty("email_addresses", out var addresses)
                        && addresses.GetArrayLength() > 0
                        && addresses[0].TryGetProperty("email_address", out var emailProperty)
                        ? emailProperty.GetString()
                        : null;

                    // The avatar's address
                    var imageUrl = data.TryGetProperty("image_url", out var imageUrlProperty)
                        ? imageUrlProperty.GetString()
                        : null;

                    // The user as Clerk describes them
                    var userDto = new UserSyncDto(clerkId, email, imageUrl);

                    // Write what Clerk owns over the stored user
                    await userManager.SyncUserAsync(userDto, cancellationToken);
                    break;

                // A deleted user
                case "user.deleted":
                    // Soft-delete the stored user
                    await userManager.DeleteUserAsync(clerkId, cancellationToken);
                    break;

                // Any other event, which only comes if the endpoint subscribes to more in Clerk's dashboard
                default:
                    throw new NotImplementedException($"Unhandled event type: {type}");
            }

            // Happy path
            logger.LogInformation(
                "Clerk webhook {DeliveryId} handled {EventType} for {ClerkId}", deliveryId, type, clerkId);

            // Accept the delivery
            return new WebhookResult(true, 200);
        }
        catch (Exception exception)
        {
            // Sad path
            logger.LogError(
                exception,
                "Clerk webhook {DeliveryId} failed handling {EventType} for {ClerkId}",
                deliveryId,
                type,
                clerkId);

            // Refuse the delivery, so Clerk retries it later
            return new WebhookResult(false, 500, exception.Message);
        }
    }
}
