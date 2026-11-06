namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Keeps a CLI run's uploads in the buckets the run means. The user secrets on a developer's machine hold the dev
/// keys, and the prod keys reach a run only as environment variables, which override them and which only the scripts
/// writing prod load. A run asks for prod with <c>--publish</c>, and the keys it carries have to agree with the flag:
/// a publish never lands in dev, and a run without the flag never writes prod, whatever its shell has loaded.
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

        // A publish without them would write dev, and a run with them but no flag would write prod
        return (publish, loaded) switch
        {
            (true, false) =>
                $"--publish writes prod, but {accessKeyVariable} is not set. The scripts that write prod load the " +
                "prod keys from backend/scripts/.env.prod.",
            (false, true) =>
                $"{accessKeyVariable} is set, so this run would write prod. Pass --publish to write prod, or run " +
                "without the prod keys to write dev.",
            _ => null,
        };
    }
}
