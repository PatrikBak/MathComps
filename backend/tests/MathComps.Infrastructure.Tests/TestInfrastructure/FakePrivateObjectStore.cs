using System.Collections.Concurrent;
using System.Text;
using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A test double for <see cref="IPrivateObjectStore"/> keeping its files in memory instead of in a bucket, and the
/// <see cref="IObjectReader"/> of what it keeps.
/// </summary>
public sealed class FakePrivateObjectStore : IPrivateObjectStore, IObjectReader
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

    /// <inheritdoc/>
    public Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken)
    {
        // A cancelled read reads nothing, as a bucket's does.
        cancellationToken.ThrowIfCancellationRequested();

        // The file's bytes read as text, or nothing when that key holds none
        return Task.FromResult(_files.TryGetValue(key, out var file) ? Encoding.UTF8.GetString(file.Content) : null);
    }

    /// <inheritdoc/>
    public Task<byte[]?> ReadBytesAsync(string key, CancellationToken cancellationToken)
    {
        // A cancelled read reads nothing, as a bucket's does.
        cancellationToken.ThrowIfCancellationRequested();

        // The file's bytes, or nothing when that key holds none
        return Task.FromResult(_files.TryGetValue(key, out var file) ? file.Content : null);
    }
}
