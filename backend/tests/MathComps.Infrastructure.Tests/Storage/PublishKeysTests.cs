using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Unit tests for <see cref="PublishKeys"/>: a run starts only when the prod keys in its environment agree with its
/// <c>--publish</c>. The keys and bucket names reach a run as environment variables, so each test sets those it needs
/// and puts back whatever the process had.
/// </summary>
public sealed class PublishKeysTests : IDisposable
{
    /// <summary>
    /// The variable the prod scripts load the access key into.
    /// </summary>
    private const string AccessKeyVariable = "CloudflareR2__AccessKeyId";

    /// <summary>
    /// The variable the prod scripts load the public bucket's name into.
    /// </summary>
    private const string PublicBucketVariable = "CloudflareR2__PublicBucketName";

    /// <summary>
    /// The variable the prod scripts load the private bucket's name into.
    /// </summary>
    private const string PrivateBucketVariable = "CloudflareR2__PrivateBucketName";

    /// <summary>
    /// Each variable's value before the test, restored after it.
    /// </summary>
    private readonly Dictionary<string, string?> _originalValues =
        new[] { AccessKeyVariable, PublicBucketVariable, PrivateBucketVariable }
            .ToDictionary(variable => variable, Environment.GetEnvironmentVariable);

    /// <inheritdoc/>
    public void Dispose()
    {
        // Leave the process environment as the test found it.
        foreach (var (variable, value) in _originalValues)
            Environment.SetEnvironmentVariable(variable, value);
    }

    /// <summary>
    /// With the prod keys loaded, a publish starts, and a run without the flag is refused, since it would write prod.
    /// </summary>
    [Fact]
    public void With_the_prod_keys_only_a_publish_starts()
    {
        // Prod's access key and bucket names in the environment, as a prod script loads them.
        Environment.SetEnvironmentVariable(AccessKeyVariable, "prod-access-key");
        Environment.SetEnvironmentVariable(PublicBucketVariable, "mathcomps-public");
        Environment.SetEnvironmentVariable(PrivateBucketVariable, "mathcomps-private");

        // Only the run that asked for prod gets to write it.
        Assert.Null(PublishKeys.Mismatch(publish: true));
        Assert.NotNull(PublishKeys.Mismatch(publish: false));
    }

    /// <summary>
    /// A publish carrying prod's keys but not a bucket's name is refused, since the user secrets would name the dev
    /// bucket in its place.
    /// </summary>
    [Fact]
    public void A_publish_missing_a_bucket_name_is_refused()
    {
        // Prod's access key and the private bucket, but no public bucket.
        Environment.SetEnvironmentVariable(AccessKeyVariable, "prod-access-key");
        Environment.SetEnvironmentVariable(PublicBucketVariable, null);
        Environment.SetEnvironmentVariable(PrivateBucketVariable, "mathcomps-private");

        // The publish would push to the dev bucket under prod's keys, so it doesn't start.
        Assert.NotNull(PublishKeys.Mismatch(publish: true));
    }

    /// <summary>
    /// Without the prod keys, a dev run starts, and a publish is refused, since it would land in dev.
    /// </summary>
    [Fact]
    public void Without_the_prod_keys_only_a_dev_run_starts()
    {
        // No access key in the environment, so the user secrets' dev keys apply.
        Environment.SetEnvironmentVariable(AccessKeyVariable, null);

        // Only the run that didn't ask for prod gets to start.
        Assert.Null(PublishKeys.Mismatch(publish: false));
        Assert.NotNull(PublishKeys.Mismatch(publish: true));
    }
}
