using System.Globalization;
using System.Web;
using MathComps.Infrastructure.Storage;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.Logging.Abstractions;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Tests for the links <see cref="R2PrivateStore"/> signs to the private bucket of the made-up account of
/// <see cref="TestR2"/>: what R2 needs of a link to take it, and how long one works. Signing makes no call, so nothing
/// here reaches R2.
/// </summary>
public sealed class R2PrivateStoreTests
{
    /// <summary>
    /// The object key of a picture in the private bucket.
    /// </summary>
    private const string Key = "user-uploads/user_abc/images/1730000000000-0b6e2f3c-1111-4a2b-9c3d-123456789abc.png";

    /// <summary>
    /// How long the store's read links work.
    /// </summary>
    private static readonly TimeSpan _linkLifetime = TimeSpan.FromHours(3);

    /// <summary>
    /// A read link points at its file in the private bucket, signed with signature version 4, the only one R2 takes.
    /// Left to itself, the S3 client signs a link to R2's host with version 2, which R2 refuses.
    /// </summary>
    [Fact]
    public void A_read_link_points_at_its_file_signed_the_way_R2_takes()
    {
        // The store over the made-up account
        using var store = NewStore();

        // A link to the picture
        var link = new Uri(store.LinkFor(Key));

        // Pointing at it in the private bucket
        Assert.Equal(TestR2.PrivateFileAddress(Key), link.GetLeftPart(UriPartial.Path));

        // Signed with signature version 4
        Assert.Equal("AWS4-HMAC-SHA256", HttpUtility.ParseQueryString(link.Query)["X-Amz-Algorithm"]);
    }

    /// <summary>
    /// A read link works for the lifetime the settings give, from its signing.
    /// </summary>
    [Fact]
    public void A_read_link_works_for_its_lifetime()
    {
        // The store over the made-up account
        using var store = NewStore();

        // A link to the picture
        var link = new Uri(store.LinkFor(Key));

        // How many seconds it works from its signing
        var expiresIn = long.Parse(
            HttpUtility.ParseQueryString(link.Query)["X-Amz-Expires"]!, CultureInfo.InvariantCulture);

        // The lifetime, give or take the second it took to sign
        Assert.InRange(expiresIn, (long)_linkLifetime.TotalSeconds - 1, (long)_linkLifetime.TotalSeconds);
    }

    /// <summary>
    /// The store over the made-up account, its read links working for <see cref="_linkLifetime"/>.
    /// </summary>
    /// <returns>The store, which the caller disposes.</returns>
    private static R2PrivateStore NewStore() =>
        // Naming the private bucket alone, its read links working the test's lifetime
        new(
            NullLogger<R2PrivateStore>.Instance,
            MsOptions.Create(TestR2.Settings),
            MsOptions.Create(new PrivateFileLinkSettings { LinkLifetime = _linkLifetime, MaxKeptLinks = 1 }));
}
