namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// A service that declares a hosted group from its manifest: it upserts the group and makes the named rounds the
/// ones it runs, raising whatever the manifest names that is not there yet. A round it links may hold nothing, the
/// problems landing through their own drafts later.
/// </summary>
public interface IHostedGroupService
{
    /// <summary>
    /// Upserts the group under its slug and makes exactly the named rounds the ones the group runs.
    /// </summary>
    /// <param name="manifest">The manifest to declare from.</param>
    /// <param name="dryRun">
    /// When true, every refusal still fires and the outcome is still worked out, but nothing is left behind. A
    /// clean dry run is the same answer the real one gives.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>What the declaration did, or would have done on a dry run.</returns>
    /// <exception cref="HostedGroupManifestException">Thrown when the manifest cannot be carried out.</exception>
    Task<HostedGroupDeclarationOutcome> DeclareAsync(
        HostedGroupManifest manifest, bool dryRun = false, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a group manifest cannot be carried out: the document is wrong on its own terms, a path or a round
/// it names is not in the state it needs, or students have already entered on terms it would change.
/// </summary>
/// <param name="message">What is wrong with the manifest.</param>
public sealed class HostedGroupManifestException(string message) : Exception(message);
