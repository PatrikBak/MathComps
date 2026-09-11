using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// A service that exchanges the positions of two problems. A problem's identity is its row, and everything a
/// student leaves on it — defenses, comments, likes, self-assessments, mark statuses, list memberships — hangs off
/// that row's id, so moving the row moves all of it. Nothing outside <see cref="Problem.Number"/> records where a
/// problem sits, which is what makes an exchange of two positions the whole operation.
/// </summary>
/// <remarks>
/// The import cannot stand in for this: it matches a draft to a problem by slug and never writes
/// <see cref="Problem.Number"/>, <see cref="Problem.RoundId"/> or <see cref="Problem.Slug"/> again.
/// </remarks>
public interface IProblemSwapService
{
    /// <summary>
    /// Exchanges the two problems' rounds and numbers, and recomputes each one's slug for the position it lands on.
    /// Both rows keep their ids, so every row pointing at either problem follows it. The exchange leaves each round
    /// holding exactly the problems it held before, which is what a round running as part of a hosted group requires.
    /// </summary>
    /// <remarks>
    /// The two problems may share a round or sit in different ones, and either may belong to a competition the site
    /// hosts. Neither a hosted group nor an embargo is a reason to refuse: moving a problem between rounds is what
    /// the exchange is for.
    /// </remarks>
    /// <param name="slugA">The slug of one problem to move.</param>
    /// <param name="slugB">The slug of the other problem to move.</param>
    /// <param name="dryRun">
    /// When true, every refusal still fires and the outcome is still worked out, but nothing is left behind. A
    /// clean dry run is the same answer the real one gives.
    /// </param>
    /// <returns>Where each problem stood and what it moves to, or would have on a dry run.</returns>
    /// <exception cref="ProblemSwapRefusedException">Thrown when the exchange cannot be carried out.</exception>
    Task<ProblemSwapResult> SwapAsync(string slugA, string slugB, bool dryRun = false);
}

/// <summary>
/// Thrown when an exchange cannot be carried out: a slug names no problem, one problem is named twice, or a slug
/// the exchange would write is already held by a third problem.
/// </summary>
/// <param name="message">What stands in the way of the exchange.</param>
public sealed class ProblemSwapRefusedException(string message) : Exception(message);
