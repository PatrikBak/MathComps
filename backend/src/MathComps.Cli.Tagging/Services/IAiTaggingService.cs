using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// AI tagging for a problem: proposes tags from a candidate vocabulary (generate pass) and prunes a proposed set
/// (veto pass). Operates purely on the supplied problem text and candidates, holding no state of its own.
/// </summary>
public interface IAiTaggingService
{
    /// <summary>
    /// Asks the model which of the candidate tags fit the problem.
    /// </summary>
    /// <param name="statement">The problem statement.</param>
    /// <param name="solution">The problem solution, or null when statement-only.</param>
    /// <param name="candidates">The approved tags eligible for this pass.</param>
    /// <param name="promptPath">Path to the prompt template for this pass.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The proposed tags keyed by slug, plus any names outside the vocabulary.</returns>
    Task<SuggestTagsResult> SuggestTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        string promptPath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the model to review its own proposed tags and keep only the ones that hold up.
    /// </summary>
    /// <param name="statement">The problem statement.</param>
    /// <param name="solution">The problem solution, or null when statement-only.</param>
    /// <param name="candidates">The proposed tags to review, each carrying its generate-pass justification.</param>
    /// <param name="promptPath">Path to the prompt template for this pass.</param>
    /// <param name="cancellationToken">A token to cancel the call.</param>
    /// <returns>The slugs the model approved.</returns>
    Task<ImmutableHashSet<string>> VetoTagsAsync(
        string statement,
        string? solution,
        IReadOnlyCollection<AiTagCandidate> candidates,
        string promptPath,
        CancellationToken cancellationToken = default);
}
