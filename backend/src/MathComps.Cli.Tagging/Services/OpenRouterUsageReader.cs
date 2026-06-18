using System.Net.Http.Headers;
using MathComps.Cli.Tagging.Settings;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Options;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// Implements <see cref="IOpenRouterUsageReader"/> by calling OpenRouter's key-info endpoint (<c>GET /key</c>)
/// with the configured API key and reading back its all-time usage figure.
/// </summary>
/// <param name="httpClient">The client the request goes out on.</param>
/// <param name="settings">The OpenRouter base URL and API key.</param>
public class OpenRouterUsageReader(HttpClient httpClient, IOptions<OpenRouterSettings> settings)
    : IOpenRouterUsageReader
{
    /// <summary>
    /// The key-info endpoint's response envelope.
    /// </summary>
    /// <param name="Data">The key's details.</param>
    private record KeyInfoResponse(KeyInfo Data);

    /// <summary>
    /// The subset of an API key's details this reader needs.
    /// </summary>
    /// <param name="Usage">Credits the key has spent all-time, where one credit is one US dollar.</param>
    private record KeyInfo(decimal Usage);

    /// <inheritdoc/>
    public async Task<decimal> GetCreditsUsedAsync(CancellationToken cancellationToken = default)
    {
        // The key-info endpoint sits next to the chat endpoint under the same base URL.
        var requestUri = $"{settings.Value.BaseUrl.TrimEnd('/')}/key";

        // Authenticate with the same key the chat passes use.
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.Value.ApiKey);

        // Fetch the key's details, failing loudly on a non-success status.
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        // Read back the all-time usage counter.
        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return json.FromJson<KeyInfoResponse>().Data.Usage;
    }
}
