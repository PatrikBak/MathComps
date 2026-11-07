using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Internal;
using Moq;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Tests for <see cref="CachedPrivateFileLinks"/>, over stand-in links that work for twelve hours and sign a new link
/// on every call, so a link handed out twice is one the decorator kept.
/// </summary>
public sealed class CachedPrivateFileLinksTests
{
    /// <summary>
    /// The cache's clock, standing still until a test moves it.
    /// </summary>
    private readonly StandingClock _clock = new();

    /// <summary>
    /// A file gets the same read link for six hours and a new one after, and another file never gets its link. Every
    /// browser showing the file within the six hours then shares one cached copy, and each link handed out still has
    /// six of its twelve hours left.
    /// </summary>
    [Fact]
    public void A_file_keeps_its_read_link_for_half_its_lifetime()
    {
        // The decorator, with room to spare
        using var links = NewLinks(maxKeptLinks: 10);

        // The picture's first link
        var first = links.LinkFor("picture");

        // Another file's link, its own
        Assert.Equal("other#2", links.LinkFor("other"));

        // A minute short of six hours on
        _clock.UtcNow += TimeSpan.FromHours(6) - TimeSpan.FromMinutes(1);

        // The picture's link is still the first one
        Assert.Equal(first, links.LinkFor("picture"));

        // Six hours on
        _clock.UtcNow += TimeSpan.FromMinutes(1);

        // The picture gets a new link
        Assert.Equal("picture#3", links.LinkFor("picture"));
    }

    /// <summary>
    /// Once the decorator keeps as many links as it may, another file's link is handed out without being kept, so texts
    /// naming any number of files can't grow the memory the links take.
    /// </summary>
    [Fact]
    public void Past_the_most_it_keeps_a_link_is_handed_out_unkept()
    {
        // The decorator, with room for one link
        using var links = NewLinks(maxKeptLinks: 1);

        // The picture's link, kept
        links.LinkFor("picture");

        // Another file's link, with no room left to keep it
        var first = links.LinkFor("other");

        // Signed afresh when asked for again
        Assert.NotEqual(first, links.LinkFor("other"));
    }

    /// <summary>
    /// The decorator over stand-in links working for twelve hours, numbering every link they sign.
    /// </summary>
    /// <param name="maxKeptLinks">The most links the decorator keeps.</param>
    /// <returns>The decorator, which the caller disposes.</returns>
    private CachedPrivateFileLinks NewLinks(int maxKeptLinks)
    {
        // How many links the stand-ins have signed
        var signed = 0;

        // The stand-in links
        var inner = new Mock<IPrivateFileLinks>();

        // Working for twelve hours
        inner.Setup(links => links.LinkLifetime).Returns(TimeSpan.FromHours(12));

        // Each one named by its file and its number
        inner.Setup(links => links.LinkFor(It.IsAny<string>()))
            .Returns((string key) => $"{key}#{++signed}");

        // The settings bounding how many links are kept
        var settings = new PrivateFileLinkSettings
        {
            LinkLifetime = TimeSpan.FromHours(12),
            MaxKeptLinks = maxKeptLinks,
        };

        // The decorator over them, on the standing clock
        return new CachedPrivateFileLinks(inner.Object, _clock, MsOptions.Create(settings));
    }

    /// <summary>
    /// A cache clock that stands still until a test moves it.
    /// </summary>
    private sealed class StandingClock : ISystemClock
    {
        /// <inheritdoc/>
        public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.UtcNow;
    }
}
