namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// A service for previewing how a draft's taxonomy would land in the database, without changing anything. For
/// the draft's competition, season and round it reports whether each already exists (so it'd be reused) or is
/// missing (so it'd be created), and lists the problem slugs that are already taken — so a typo that would
/// spawn a junk entity, or a surprise clash, surfaces before any import runs. Read-only: it only queries.
/// </summary>
public interface IDraftResolutionService
{
    /// <summary>
    /// Looks the draft's competition, season and round up in the database and reports, for each, whether it
    /// already exists or would need creating, plus any of the draft's problem slugs that are already taken.
    /// Read-only — no rows are inserted or updated.
    /// </summary>
    /// <param name="target">The taxonomy and season the draft resolves against.</param>
    /// <param name="problemOrders">
    /// The 1-based positions of the draft's problems, used to derive candidate slugs.
    /// </param>
    /// <returns>Which entities exist versus would be created, and any colliding problem slugs.</returns>
    Task<DraftDbPreview> PreviewAsync(DraftTarget target, IReadOnlyList<int> problemOrders);
}
