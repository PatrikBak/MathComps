namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// A service for previewing how a draft would land in the database, without changing anything. For the draft's
/// competition, season and round it reports whether each already exists (so it'd be reused) or is missing (so
/// it'd be created); and for every problem half whose slug already exists it classifies what the import would do
/// — a clean add, an in-place overwrite, or a hard conflict (a second original, or an orphan translation) —
/// given the draft's language and original-vs-translation flag. So a typo that would spawn a junk entity, or a
/// surprise clash, surfaces before any import runs. Read-only: it only queries.
/// </summary>
public interface IDraftResolutionService
{
    /// <summary>
    /// Looks the draft's competition, season and round up in the database and reports, for each, whether it
    /// already exists or would need creating; and for each draft half landing on an already-existing problem
    /// slug, classifies the import outcome from the draft's language and original flag against the rows present.
    /// Read-only — no rows are inserted or updated.
    /// </summary>
    /// <param name="target">The taxonomy, season, language and original flag the draft resolves against.</param>
    /// <param name="problems">
    /// The draft's problems — their positions (to derive candidate slugs) and whether each carries a solution.
    /// </param>
    /// <returns>Which entities exist versus would be created, and the per-half resolutions for colliding slugs.</returns>
    Task<DraftDbPreview> PreviewAsync(DraftTarget target, IReadOnlyList<DraftProblemRef> problems);
}
