using System.Collections.Concurrent;
using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A test double for <see cref="IPrivateObjectStore"/> keeping its files in memory instead of in a bucket.
/// </summary>
public sealed class FakePrivateObjectStore : IPrivateObjectStore
{
    /// <summary>
    /// Every stored file's bytes and media type, by key.
    /// </summary>
    private readonly ConcurrentDictionary<string, (byte[] Content, string ContentType)> _files = new();

    /// <summary>
    /// The keys files are stored under.
    /// </summary>
    public IReadOnlyCollection<string> Keys => [.. _files.Keys];

    /// <summary>
    /// The file stored under a key.
    /// </summary>
    /// <param name="key">The key it is stored under.</param>
    /// <returns>Its bytes and media type.</returns>
    public (byte[] Content, string ContentType) this[string key] => _files[key];

    /// <inheritdoc/>
    public Task PutAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        // A cancelled write stores nothing, as a bucket's does.
        cancellationToken.ThrowIfCancellationRequested();

        // Keep the file under its key.
        _files[key] = (content, contentType);

        // Nothing leaves the process.
        return Task.CompletedTask;
    }
}
