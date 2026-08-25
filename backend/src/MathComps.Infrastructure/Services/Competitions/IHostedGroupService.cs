namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// A service that declares a hosted group from its manifest: it upserts the group and links the rounds it runs.
/// Declaring comes after those rounds' own drafts have landed, since it only ever links rounds that already exist.
/// </summary>
public interface IHostedGroupService
{
    /// <summary>
    /// Upserts the group under its slug and makes exactly the named rounds the ones the group runs.
    /// </summary>
    /// <param name="manifest">The manifest to declare from.</param>
    /// <param name="dryRun">
    /// When true, every refusal still fires and the outcome is still worked out, but nothing is written. The
    /// checks all run before the first write either way, so a clean dry run is the same answer the real one gives.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>What the declaration did, or would have done on a dry run.</returns>
    /// <exception cref="HostedGroupManifestException">Thrown when the manifest cannot be carried out.</exception>
    Task<HostedGroupDeclarationOutcome> DeclareAsync(
        HostedGroupManifest manifest, bool dryRun = false, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a group manifest cannot be carried out: the document is wrong on its own terms, a round it names
/// is missing or not in the state it needs, or students have already entered on terms it would change.
/// </summary>
/// <param name="message">What is wrong with the manifest.</param>
public sealed class HostedGroupManifestException(string message) : Exception(message);
