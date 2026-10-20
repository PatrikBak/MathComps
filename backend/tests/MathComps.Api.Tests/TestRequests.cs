using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace MathComps.Api.Tests;

/// <summary>
/// Builds the requests the tests send through a route's pipeline.
/// </summary>
internal static class TestRequests
{
    /// <summary>
    /// Builds a request from a caller carrying a JSON body, the way a client sends one.
    /// </summary>
    /// <param name="caller">Who is asking.</param>
    /// <param name="services">The services the request is handed.</param>
    /// <param name="body">What the body holds.</param>
    /// <returns>The request.</returns>
    public static DefaultHttpContext WithJsonBody(ClaimsPrincipal caller, IServiceProvider services, object body)
    {
        // The body, written as a client would
        var json = JsonSerializer.SerializeToUtf8Bytes(body);

        // The request from the caller, carrying the body
        var request = new DefaultHttpContext
        {
            User = caller,
            RequestServices = services,
            Request =
            {
                ContentType = "application/json",
                Body = new MemoryStream(json),
                ContentLength = json.Length,
            },
        };

        // A bare request reads no body until it says it can carry one
        request.Features.Set<IHttpRequestBodyDetectionFeature>(new CarriesBody());

        // The request
        return request;
    }

    /// <summary>
    /// Says a request can carry a body, as a server says of every request with content.
    /// </summary>
    private sealed class CarriesBody : IHttpRequestBodyDetectionFeature
    {
        /// <inheritdoc/>
        public bool CanHaveBody => true;
    }
}
