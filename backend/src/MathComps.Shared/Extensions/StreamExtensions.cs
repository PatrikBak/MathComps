namespace MathComps.Shared.Extensions;

/// <summary>
/// Provides extension methods for <see cref="Stream"/>.
/// </summary>
public static class StreamExtensions
{
    /// <summary>
    /// Reads a stream to its end, unless it holds more than a number of bytes. The read stops at the first chunk past
    /// that number, so a stream far bigger than it is never held in memory whole.
    /// </summary>
    /// <param name="stream">The stream to read.</param>
    /// <param name="maxBytes">The most bytes the stream may hold.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>Every byte of the stream, or null when it holds more than <paramref name="maxBytes"/>.</returns>
    public static async Task<byte[]?> ReadAtMostAsync(
        this Stream stream, long maxBytes, CancellationToken cancellationToken = default)
    {
        // The bytes read so far
        using var read = new MemoryStream();

        // The most bytes one read hands over, the size a stream copies in
        const int chunkSize = 81920;

        // The bytes each read hands over
        var chunk = new byte[chunkSize];

        // Read the stream chunk by chunk, until it ends
        int chunkLength;
        while ((chunkLength = await stream.ReadAsync(chunk, cancellationToken)) > 0)
        {
            // A chunk taking the stream past the most bytes makes it too big to read
            if (read.Length + chunkLength > maxBytes)
                return null;

            // Keep the chunk
            read.Write(chunk, 0, chunkLength);
        }

        // The whole stream
        return read.ToArray();
    }
}
