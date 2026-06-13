using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// A service that commits a validated draft to the database and remote image storage. The mutating counterpart
/// to <see cref="IDraftResolutionService"/>: where the resolution service previews, this performs. Meant to run
/// only after the draft has been validated — it trusts conflicts (e.g. a forbidden second original) to have been
/// caught there and guards against them defensively rather than re-validating.
/// </summary>
public interface IDraftApplyService
{
    /// <summary>
    /// Writes the draft. Upserts the taxonomy by slug — competition, category, round, season, round-instance —
    /// creating what's missing, reusing what exists, sourcing structural fields from the registry; uploads each
    /// problem's images and rewrites their markdown refs; then inserts net-new <see cref="Problem"/> rows and
    /// overwrites existing <see cref="ProblemText"/> rows in place.
    /// Partial failure is tolerated: orphaned uploads and half-written problems are reconciled by a re-run, so
    /// there's no wrapping transaction.
    /// </summary>
    /// <param name="target">The taxonomy and season the draft lands under.</param>
    /// <param name="date">The round-instance date from <c>_meta</c>, set when the round-instance is created.</param>
    /// <param name="problems">The problems to write — content, authors, images, per-language texts.</param>
    /// <param name="draftFolder">The draft folder on disk, the root the relative <c>images/…</c> refs resolve
    /// against.</param>
    /// <returns>A summary of what was created versus reused and what each text became.</returns>
    Task<DraftApplyResult> ApplyAsync(
        DraftTarget target,
        DateOnly date,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder);
}
