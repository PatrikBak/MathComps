using System.Net.Mime;
using Microsoft.Net.Http.Headers;
using Sentry.Extensibility;

namespace MathComps.Api.Extensions;

/// <summary>
/// An <see cref="IRequestPayloadExtractor"/> reading a JSON request body into an error as its text. A body of any other
/// media type stays behind, a raw uploaded file above all.
/// </summary>
internal sealed class JsonRequestPayloadExtractor : DefaultRequestPayloadExtractor
{
    /// <inheritdoc />
    protected override bool IsSupported(IHttpRequest request) =>
        // A body whose media type is JSON, whatever parameters such as a charset ride with it
        MediaTypeHeaderValue.TryParse(request.ContentType, out var contentType)
        && contentType.MediaType.Equals(MediaTypeNames.Application.Json, StringComparison.OrdinalIgnoreCase);
}
