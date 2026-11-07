namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Keeps a CLI run's uploads in the buckets the run means. The user secrets on a developer's machine hold the dev
/// keys and bucket names, and prod's reach a run only as environment variables, which override them and which only
/// the scripts writing prod load. A run asks for prod with <c>--publish</c>, and the keys it carries have to agree
/// with the flag: a publish never lands in dev, and a run without the flag never writes prod, whatever its shell has
/// loaded.
/// </summary>
public static class PublishKeys
{
    /// <summary>
    /// Says why a run can't start with the keys it carries, given whether it publishes.
    /// </summary>
    /// <param name="publish">Whether the run was given <c>--publish</c>.</param>
    /// <returns>The reason the run must stop, or null when its keys match the flag.</returns>
    public static string? Mismatch(bool publish)
    {
        // The access key's environment variable
        const string accessKeyVariable = $"{R2Settings.SectionName}__{nameof(R2Settings.AccessKeyId)}";

        // The prod keys count as loaded once their access key is in the environment
        var loaded = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(accessKeyVariable));

        // The bucket names' environment variables. A name the environment leaves out comes from the user secrets,
        // which name a dev bucket
        string[] bucketVariables =
        [
            $"{R2Settings.SectionName}__{nameof(R2Settings.PublicBucketName)}",
            $"{R2Settings.SectionName}__{nameof(R2Settings.PrivateBucketName)}",
        ];

        // The first of them the environment leaves out
        var unsetBucketVariable = bucketVariables.FirstOrDefault(variable =>
            string.IsNullOrEmpty(Environment.GetEnvironmentVariable(variable)));

        // A publish without prod's keys or bucket names would write dev, and a run with the keys but no flag would
        // write prod
        return (publish, loaded) switch
        {
            (true, false) =>
                $"--publish writes prod, but {accessKeyVariable} is not set. The scripts that write prod load the " +
                "prod keys from backend/scripts/.env.prod.",
            (true, true) when unsetBucketVariable is not null =>
                $"--publish writes prod, but {unsetBucketVariable} is not set, so the run would write the dev bucket " +
                "the user secrets name. The scripts that write prod load it from backend/scripts/.env.prod.",
            (false, true) =>
                $"{accessKeyVariable} is set, so this run would write prod. Pass --publish to write prod, or run " +
                "without the prod keys to write dev.",
            _ => null,
        };
    }
}
