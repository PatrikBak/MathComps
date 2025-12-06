using MathComps.Infrastructure.Services;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for mapping webhook endpoints.
/// </summary>
public static class WebhookExtensions
{
    /// <summary>
    /// Maps the Clerk webhook endpoint.
    /// </summary>
    /// <param name="app">The endpoint route builder.</param>
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        // The endpoint to sync users from Clerk
        app.MapPost("/api/webhooks/clerk", async (
            HttpContext context,
            IClerkWebhookService webhookService) =>
        {
            // Read the request body stream.
            using var reader = new StreamReader(context.Request.Body);
            var payload = await reader.ReadToEndAsync();

            // Prepare headers for webhook verification.
            var headers = new System.Net.WebHeaderCollection
            {
                { "svix-id", context.Request.Headers["svix-id"] },
                { "svix-timestamp", context.Request.Headers["svix-timestamp"] },
                { "svix-signature", context.Request.Headers["svix-signature"] }
            };

            // Process the webhook.
            var result = await webhookService.ProcessClerkWebhookAsync(
                payload,
                headers, context.RequestAborted
            );

            // Return appropriate response.
            return result.IsSuccess
                ? Results.Ok()
                : Results.Problem(detail: result.ErrorMessage, statusCode: result.StatusCode);
        });
    }
}
