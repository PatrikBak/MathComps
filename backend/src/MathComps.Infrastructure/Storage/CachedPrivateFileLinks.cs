using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Storage;

/// <summary>
/// An <see cref="IPrivateFileLinks"/> that decorates another, keeping each file's read link in memory for half of
/// <see cref="IPrivateFileLinks.LinkLifetime"/>. Everyone asking for the file in that time gets the same link, so a
/// browser that cached the file keeps its copy, and every link handed out has at least half its life left. Once
/// <see cref="PrivateFileLinkSettings.MaxKeptLinks"/> links are kept, another file's link is signed and handed out
/// without being kept.
/// </summary>
/// <param name="inner">The links the decorator signs through.</param>
/// <param name="clock">The clock the kept links age by.</param>
/// <param name="privateFileLinkSettings">The settings bounding how many links are kept.</param>
public sealed class CachedPrivateFileLinks(
    IPrivateFileLinks inner, ISystemClock clock, IOptions<PrivateFileLinkSettings> privateFileLinkSettings)
    : IPrivateFileLinks, IDisposable
{
    #region Private Types

    /// <summary>
    /// What a file's read link is kept under in the cache.
    /// </summary>
    /// <param name="Key">The file's object key.</param>
    private sealed record ReadLinkEntry(string Key);

    #endregion

    /// <summary>
    /// The kept links, each counting once toward the most the cache holds.
    /// </summary>
    private readonly MemoryCache _cache = new(new MemoryCacheOptions
    {
        Clock = clock,
        SizeLimit = privateFileLinkSettings.Value.MaxKeptLinks,
    });

    /// <inheritdoc/>
    public TimeSpan LinkLifetime => inner.LinkLifetime;

    /// <inheritdoc/>
    public string LinkFor(string key) =>
        // The file's kept link, or one signed now and kept while there is room
        _cache.GetOrCreate(new ReadLinkEntry(key), entry =>
        {
            // Kept for half its life, so it still has the other half once handed out
            entry.AbsoluteExpirationRelativeToNow = inner.LinkLifetime / 2;

            // Counting once toward the most the cache holds
            entry.Size = 1;

            // Signed by the inner links
            return inner.LinkFor(key);
        })!;

    /// <inheritdoc/>
    public void Dispose() =>
        // Let go of the kept links
        _cache.Dispose();
}
