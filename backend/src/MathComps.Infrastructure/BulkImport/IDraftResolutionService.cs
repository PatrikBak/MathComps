namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// A service for previewing how a draft would land in the database, without changing anything. For the draft's
/// competition, season and round it reports whether each already exists (so it'd be reused) or is missing (so
/// it'd be created); and for every text variant whose problem slug already exists it classifies what the import
/// would do — a clean add, a no-op (the body already matches), an in-place overwrite, or a second-original
/// conflict. So a typo that would spawn a junk entity, or a surprise clash, surfaces before any import runs.
/// Reads only: it queries the database and the draft's image files, but writes nothing.
/// </summary>
public interface IDraftResolutionService
{
    /// <summary>
    /// Looks the draft's competition, season and round up in the database and reports, for each, whether it
    /// already exists or would need creating; and for each text variant landing on an already-existing problem
    /// slug, classifies the import outcome — reproducing the body the import would store so an unchanged re-import
    /// is told apart from a real overwrite. Reads only — no rows are inserted or updated.
    /// </summary>
    /// <param name="target">The taxonomy and season the draft resolves against.</param>
    /// <param name="problems">
    /// The draft's problems — their positions (to derive candidate slugs), text variants, and image basenames.
    /// </param>
    /// <param name="draftFolder">The draft folder the image refs resolve against, to size the would-be bodies.</param>
    /// <returns>Which entities exist versus would be created, and the per-text resolutions for colliding slugs.</returns>
    Task<DraftDbPreview> PreviewAsync(
        DraftTarget target, IReadOnlyList<DraftProblemContent> problems, string draftFolder);
}
