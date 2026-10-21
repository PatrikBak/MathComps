using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// A service that imports a draft into the database and remote image storage. The database side is carried out whole
/// or not at all. A dry run carries out the very same import without keeping it, so what it reports is what the real
/// run then does against the database as it stands.
/// </summary>
public interface IDraftImportService
{
    /// <summary>
    /// Imports the draft. Upserts the taxonomy the competition path addresses — every competition down the chain, the
    /// season, and the round — creating what's missing, reusing what exists, sourcing structural fields from the
    /// registry; rewrites each problem's figure refs to the keys they upload under; then inserts net-new
    /// <see cref="Problem"/> rows and overwrites existing <see cref="ProblemText"/> rows in place, filing a problem the
    /// draft describes as a proposal in the pool through its <see cref="Proposal"/> row. Only a clean, real run
    /// uploads the figures and keeps what it wrote.
    /// </summary>
    /// <remarks>
    /// Every reason the database refuses the draft comes back in the outcome, all of them at once, rather than as an
    /// exception. A stored taxonomy node the registry can't place stops the import before anything else is checked,
    /// which the outcome tells apart as a <see cref="DraftImportStoppedAtOrphans"/>.
    /// The draft owns the round's date and visibility: both are written on every run, so a re-import naming no embargo
    /// lifts the stored one. A round a group runs is the exception, whose embargo the draft has to match.
    /// </remarks>
    /// <param name="target">The competition and season the draft lands under.</param>
    /// <param name="date">The round's date.</param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    /// <param name="problems">The problems to write — content, authors, images, per-language texts.</param>
    /// <param name="draftFolder">The draft folder on disk, the root the relative <c>images/…</c> refs resolve
    /// against.</param>
    /// <param name="dryRun">Whether to work out the import without uploading or keeping anything.</param>
    /// <returns>What the import did, or would have done, and every reason the database refuses it.</returns>
    /// <exception cref="InvalidOperationException">
    /// The registry cannot place a node on the draft's path, a tag slug is not in the approved vocabulary, or a new
    /// problem carries no text.
    /// </exception>
    Task<DraftImportOutcome> ImportAsync(
        DraftTarget target,
        DateOnly date,
        DateTimeOffset? visibleSince,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder,
        bool dryRun);
}
