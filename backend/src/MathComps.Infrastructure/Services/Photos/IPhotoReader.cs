using MathComps.Infrastructure.Services.Ai;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Photos;

/// <summary>
/// Reads a photo of a handwritten page: writes out its text as the writer put it, with a marker where each drawing
/// sits, and cuts every drawing out as a picture of its own.
/// </summary>
public interface IPhotoReader
{
    /// <summary>
    /// Reads one photo of a page.
    /// </summary>
    /// <param name="photo">The photo file's bytes, a JPEG, PNG or WebP image.</param>
    /// <param name="cancellationToken">A token to cancel the reading.</param>
    /// <returns>The reading, together with the model that answered and what the call billed.</returns>
    /// <exception cref="UnreadablePhotoException">Thrown when the photo is not an image that can be read, or would
    /// decode too large.</exception>
    Task<ChatCallResult<PhotoReading>> ReadAsync(
        ReadOnlyMemory<byte> photo, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a photo is not a JPEG, PNG or WebP image that can be decoded, or is too large to decode.
/// </summary>
public sealed class UnreadablePhotoException()
    : MathCompsException(
        "The photo could not be read; send it as a JPEG, PNG or WebP image",
        RefusalKind.Invalid,
        LogLevel.Information);
