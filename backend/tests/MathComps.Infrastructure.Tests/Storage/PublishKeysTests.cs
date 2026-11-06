using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.Storage;

/// <summary>
/// Unit tests for <see cref="PublishKeys"/>: a run starts only when the prod keys in its environment agree with its
/// <c>--publish</c>. The keys reach a run as the access key's environment variable, so each test sets that variable
/// and puts back whatever the process had.
/// </summary>
public sealed class PublishKeysTests : IDisposable
{
    /// <summary>
    /// The variable the prod scripts load the access key into.
    /// </summary>
    private const string AccessKeyVariable = "CloudflareR2__AccessKeyId";

    /// <summary>
    /// The variable's value before the test, restored after it.
    /// </summary>
    private readonly string? _originalAccessKey = Environment.GetEnvironmentVariable(AccessKeyVariable);

    /// <inheritdoc/>
    public void Dispose() =>
        // Leave the process environment as the test found it.
        Environment.SetEnvironmentVariable(AccessKeyVariable, _originalAccessKey);

    /// <summary>
    /// With the prod keys loaded, a publish starts, and a run without the flag is refused, since it would write prod.
    /// </summary>
    [Fact]
    public void With_the_prod_keys_only_a_publish_starts()
    {
        // Prod's access key in the environment, as a prod script loads it.
        Environment.SetEnvironmentVariable(AccessKeyVariable, "prod-access-key");

        // Only the run that asked for prod gets to write it.
        Assert.Null(PublishKeys.Mismatch(publish: true));
        Assert.NotNull(PublishKeys.Mismatch(publish: false));
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
