using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A test double for <see cref="IPrivateFileLinks"/> whose links name the object key they reach, so a test reads
/// exactly which file a link is for.
/// </summary>
public sealed class StandInFileLinks : IPrivateFileLinks
{
    /// <inheritdoc/>
    public TimeSpan LinkLifetime => TimeSpan.FromHours(12);

    /// <inheritdoc/>
    public string LinkFor(string key) =>
        // A read link naming the file it reads
        $"read:{key}";
}
