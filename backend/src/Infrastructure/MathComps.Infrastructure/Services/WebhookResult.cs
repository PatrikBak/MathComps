namespace MathComps.Infrastructure.Services;

/// <summary>
/// Represents the result of webhook processing.
/// </summary>
/// <param name="IsSuccess">Whether the webhook was processed successfully.</param>
/// <param name="StatusCode">The HTTP status code to return.</param>
/// <param name="ErrorMessage">The error message if processing failed.</param>
public record WebhookResult(bool IsSuccess, int StatusCode, string? ErrorMessage = null);
