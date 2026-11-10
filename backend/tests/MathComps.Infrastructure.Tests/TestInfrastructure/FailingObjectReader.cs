using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A reader of the private store whose read of one key fails, as a read fails while the bucket can't be reached.
/// </summary>
/// <param name="store">The store every other key is read from.</param>
/// <param name="failingKey">The key whose read fails.</param>
public sealed class FailingObjectReader(IObjectReader store, string failingKey) : IObjectReader
{
    /// <inheritdoc/>
    public Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken) =>
        // The failing key's read breaks, every other key's reaches the store
        key == failingKey
            ? Task.FromException<string?>(new HttpRequestException("The bucket can't be reached."))
            : store.ReadTextAsync(key, cancellationToken);

    /// <inheritdoc/>
    public Task<byte[]?> ReadBytesAsync(string key, CancellationToken cancellationToken) =>
        // The failing key's read breaks, every other key's reaches the store
        key == failingKey
            ? Task.FromException<byte[]?>(new HttpRequestException("The bucket can't be reached."))
            : store.ReadBytesAsync(key, cancellationToken);
}
