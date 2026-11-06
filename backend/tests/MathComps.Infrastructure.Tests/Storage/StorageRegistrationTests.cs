using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Tests for the storage registration, <c>AddStorage</c>: a host whose settings name only the buckets it uses still
/// reaches those. No R2 call is made, since building a bucket's client needs no network.
/// </summary>
public sealed class StorageRegistrationTests
{
    /// <summary>
    /// A host naming only the private bucket, as the API's settings do, gets that bucket's reader.
    /// </summary>
    [Fact]
    public void A_host_naming_only_the_private_bucket_reads_from_it()
    {
        // The API's settings: the account, its key, and the private bucket alone.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CloudflareR2:AccountId"] = "account",
                ["CloudflareR2:AccessKeyId"] = "access-key",
                ["CloudflareR2:SecretAccessKey"] = "secret-key",
                ["CloudflareR2:PrivateBucketName"] = "mathcomps-private",
            })
            .Build();

        // The storage registered over them.
        using var provider = new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddLogging()
            .AddStorage()
            .BuildServiceProvider();

        // The reader is built, so neither the settings nor the private store asked for the public bucket.
        Assert.NotNull(provider.GetRequiredService<IObjectReader>());
    }
}
