using System.Text.Json;

using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense.Content;

/// <summary>
/// An <see cref="IDefenseContentResolver"/> reading the blobs the handout build publishes to object storage, one per
/// handout per language. A handout's blob is cached for its configured window, so an edited problem reaches new
/// defenses without a deploy while a run of defenses against one handout costs a single read.
/// </summary>
/// <param name="objectReader">Reads the published blobs.</param>
/// <param name="cache">The in-memory cache.</param>
/// <param name="options">How long a cached handout is served for.</param>
/// <param name="logger">Records a blob that cannot be understood.</param>
public sealed class StoredDefenseContentResolver(
    IObjectReader objectReader, IMemoryCache cache, IOptions<DefenseContentOptions> options,
    ILogger<StoredDefenseContentResolver> logger)
    : IDefenseContentResolver
{
    /// <summary>
    /// How long a cached handout is served before the next lookup reads it again.
    /// </summary>
    private readonly TimeSpan _cacheWindow = TimeSpan.FromSeconds(options.Value.CacheSeconds);

    /// <inheritdoc/>
    public async Task<DefenseProblemContent?> ResolveAsync(
        HandoutEnvironmentTarget target, Language language, CancellationToken cancellationToken)
    {
        // The blob holding every defendable environment of this handout in this language
        var key = HandoutStorage.DefenseContentKey(target.HandoutContentId, language);
        var variant = await ReadVariantAsync(key, cancellationToken);

        // The environment being defended, absent when neither the handout nor the environment is published
        return variant.GetValueOrDefault(target.EnvironmentId);
    }

    /// <summary>
    /// Returns a handout variant, reading it from storage when its window has run out. A key nothing is published
    /// under yields no environments and is cached like any other answer, so a target naming a handout that doesn't
    /// exist can't be used to hammer storage.
    /// </summary>
    /// <param name="key">The object key to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The variant's environments, empty when nothing usable is published under that key.</returns>
    private async Task<IReadOnlyDictionary<string, DefenseProblemContent>> ReadVariantAsync(
        string key, CancellationToken cancellationToken)
    {
        // Serve the cached variant, reading it again once its window has run out
        var variant = await cache.GetOrCreateAsync(key, async entry =>
        {
            // How long this read stays good for
            entry.AbsoluteExpirationRelativeToNow = _cacheWindow;

            // The published blob, absent when the handout isn't published in this language
            var content = await objectReader.ReadTextAsync(key, cancellationToken);

            // Nothing published means nothing to defend
            return content is null ? [] : ParseVariant(content, key);
        });

        // GetOrCreateAsync types its result as nullable, though the factory above never yields null
        return variant ?? [];
    }

    /// <summary>
    /// Parses a published blob into its environments, treating an unreadable one as an empty handout: a malformed
    /// blob must refuse the defenses it would have backed, not take the API down.
    /// </summary>
    /// <param name="content">The blob's content.</param>
    /// <param name="key">The object key it came from, for the log line.</param>
    /// <returns>The variant's environments, keyed by permanent environment id.</returns>
    private Dictionary<string, DefenseProblemContent> ParseVariant(string content, string key)
    {
        try
        {
            // Every defendable environment of this handout variant
            return content.FromJson<Dictionary<string, DefenseProblemContent>>();
        }
        catch (JsonException exception)
        {
            // Say which blob is bad, since nothing else will surface it
            logger.LogError(exception, "Defense content at {Key} could not be read", key);

            // No environment resolves from it, so every defense against this handout is refused
            return [];
        }
    }
}
