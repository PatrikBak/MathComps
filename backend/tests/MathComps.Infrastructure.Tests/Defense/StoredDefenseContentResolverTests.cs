using System.Collections.Immutable;

using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using static Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Unit tests for <see cref="StoredDefenseContentResolver"/>: the object key a target maps to, that a cached handout
/// is served without reading storage again, and what an absent or unreadable blob resolves to. Storage is faked, so
/// no network is involved. Expiry itself is <see cref="MemoryCache"/>'s job and is not retested here.
/// </summary>
public sealed class StoredDefenseContentResolverTests
{
    /// <summary>
    /// A blob holding one defendable environment, in the shape the handout build publishes.
    /// </summary>
    private const string OneEnvironmentBlob = /*lang=json,strict*/
        """{"env-1":{"statement":"the statement","reference":"the reference","hints":["first","second"]}}""";

    /// <summary>
    /// The target every test resolves unless it is checking what an unknown one does.
    /// </summary>
    private static readonly HandoutEnvironmentTarget _target = new("handout-1", "env-1");

    /// <summary>
    /// A target resolves to the blob published for its handout in its language, and comes back with everything the
    /// examiner is given about it.
    /// </summary>
    [Fact]
    public async Task A_target_resolves_to_its_published_content()
    {
        // A store holding the handout's Slovak blob
        var reader = new FakeObjectReader();
        reader.Put("handouts/defense/handout-1.sk.json", OneEnvironmentBlob);

        // Resolve the environment out of it
        var content = await Resolver(reader).ResolveAsync(_target, Language.SK, CancellationToken.None);

        // It carries the statement, the reference, and the author's hints in order
        Assert.NotNull(content);
        Assert.Equal("the statement", content.Statement);
        Assert.Equal("the reference", content.Reference);
        Assert.Equal(["first", "second"], content.Hints);
    }

    /// <summary>
    /// Each language reads its own blob, so a handout defended in Czech is never answered from the Slovak variant.
    /// </summary>
    [Fact]
    public async Task Each_language_reads_its_own_blob()
    {
        // Only the Czech variant is published
        var reader = new FakeObjectReader();
        reader.Put("handouts/defense/handout-1.cs.json", OneEnvironmentBlob);
        var resolver = Resolver(reader);

        // Czech resolves; English, which nothing was published for, does not
        Assert.NotNull(await resolver.ResolveAsync(_target, Language.CS, CancellationToken.None));
        Assert.Null(await resolver.ResolveAsync(_target, Language.EN, CancellationToken.None));
    }

    /// <summary>
    /// A cached handout is served without touching storage, which is what keeps a run of defenses against one
    /// handout off the network.
    /// </summary>
    [Fact]
    public async Task A_cached_handout_is_served_without_a_second_read()
    {
        // A store holding the handout
        var reader = new FakeObjectReader();
        reader.Put("handouts/defense/handout-1.sk.json", OneEnvironmentBlob);
        var resolver = Resolver(reader);

        // Resolve twice, both inside the window
        await resolver.ResolveAsync(_target, Language.SK, CancellationToken.None);
        var second = await resolver.ResolveAsync(_target, Language.SK, CancellationToken.None);

        // The second was answered from memory — storage saw exactly one read
        Assert.NotNull(second);
        Assert.Single(reader.Reads);
    }

    /// <summary>
    /// A target naming a handout nothing is published for is cached like any other answer, so it can't be used to
    /// put a read through to storage on every request.
    /// </summary>
    [Fact]
    public async Task An_absent_handout_is_read_once_and_then_cached()
    {
        // A store holding nothing at all
        var reader = new FakeObjectReader();
        var resolver = Resolver(reader);

        // Resolve the same unpublished handout twice
        Assert.Null(await resolver.ResolveAsync(_target, Language.SK, CancellationToken.None));
        Assert.Null(await resolver.ResolveAsync(_target, Language.SK, CancellationToken.None));

        // Only the first went to storage
        Assert.Single(reader.Reads);
    }

    /// <summary>
    /// An environment the handout doesn't carry resolves to nothing, even though its handout does.
    /// </summary>
    [Fact]
    public async Task An_unknown_environment_resolves_to_nothing()
    {
        // A store holding a handout that carries only env-1
        var reader = new FakeObjectReader();
        reader.Put("handouts/defense/handout-1.sk.json", OneEnvironmentBlob);

        // Asking for a different environment of it comes back empty
        var content = await Resolver(reader).ResolveAsync(
            new HandoutEnvironmentTarget("handout-1", "env-missing"), Language.SK, CancellationToken.None);
        Assert.Null(content);
    }

    /// <summary>
    /// A blob that can't be parsed refuses the defenses it would have backed, so one bad handout never takes the
    /// endpoint down for every other.
    /// </summary>
    [Fact]
    public async Task An_unreadable_blob_resolves_to_nothing()
    {
        // A store holding something that isn't the shape a blob has
        var reader = new FakeObjectReader();
        reader.Put("handouts/defense/handout-1.sk.json", "not json at all");

        // Resolving against it comes back empty
        Assert.Null(await Resolver(reader).ResolveAsync(_target, Language.SK, CancellationToken.None));
    }

    /// <summary>
    /// Builds a resolver over the given storage, with a window long enough that nothing expires mid-test.
    /// </summary>
    /// <param name="reader">The storage to read blobs from.</param>
    /// <returns>The resolver.</returns>
    private static StoredDefenseContentResolver Resolver(FakeObjectReader reader) =>
        new(
            reader,
            new MemoryCache(new MemoryCacheOptions()),
            Create(new DefenseContentOptions { CacheSeconds = 600 }),
            NullLogger<StoredDefenseContentResolver>.Instance);

    /// <summary>
    /// A test double for <see cref="IObjectReader"/> over an in-memory store, recording each read so a test can see
    /// how often storage was reached for.
    /// </summary>
    private sealed class FakeObjectReader : IObjectReader
    {
        /// <summary>
        /// What is stored, keyed by object key.
        /// </summary>
        private readonly Dictionary<string, string> _objects = [];

        /// <summary>
        /// Every read, in call order.
        /// </summary>
        public ImmutableList<string> Reads { get; private set; } = [];

        /// <summary>
        /// Stores an object, replacing whatever was under that key.
        /// </summary>
        /// <param name="key">The object key.</param>
        /// <param name="content">The object's content.</param>
        public void Put(string key, string content) => _objects[key] = content;

        /// <inheritdoc/>
        public Task<string?> ReadTextAsync(string key, CancellationToken cancellationToken)
        {
            // Record the call, so a test can assert on how storage was reached for
            Reads = Reads.Add(key);

            // The content, or nothing when that key holds none
            return Task.FromResult(_objects.GetValueOrDefault(key));
        }
    }
}
