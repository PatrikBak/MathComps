using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// What the import does to an entity the draft names: reuse it unchanged, update it in place when the draft differs
/// from it, or create it when it is absent.
/// </summary>
public enum ResolutionAction
{
    /// <summary>The entity already exists in the DB and is reused unchanged.</summary>
    Reuse,

    /// <summary>The entity already exists but differs from the draft, so it is updated in place.</summary>
    Update,

    /// <summary>The entity is absent and would need to be created.</summary>
    Create
}

/// <summary>
/// The resolution outcome for a single taxonomy entity the draft references.
/// </summary>
/// <param name="EntityKind">The kind of entity (<c>competition</c>, <c>season</c>, <c>round</c>).</param>
/// <param name="Identifier">The lookup key — a competition path, a year, or a path and season together.</param>
/// <param name="Action">What resolving it does — reuse unchanged, update in place, or create.</param>
public record EntityResolution(
    string EntityKind,
    string Identifier,
    ResolutionAction Action);

/// <summary>
/// What importing one of the draft's text variants would do, decided from that text's originality and language
/// against the rows already present for the same <c>(problem, document type)</c>.
/// </summary>
public enum DraftTextAction
{
    /// <summary>
    /// An original text adds the first original for this document type (none present yet, nor any text in its
    /// language).
    /// </summary>
    AddOriginal,

    /// <summary>An original text replaces the existing original in the same language, in place.</summary>
    OverwriteOriginal,

    /// <summary>An original text matches the existing same-language original byte-for-byte — importing changes nothing.</summary>
    UnchangedOriginal,

    /// <summary>
    /// An original text in a different language than the existing original — importing would create a second
    /// original, which the one-original-per-document index forbids. A hard conflict.
    /// </summary>
    SecondOriginal,

    /// <summary>A translation adds a text onto the original (none in this language yet).</summary>
    AddTranslation,

    /// <summary>
    /// A translation, or an original on a document type holding no original, replaces the existing same-language text
    /// in place.
    /// </summary>
    OverwriteTranslation,

    /// <summary>
    /// A translation, or an original on a document type holding no original, matches the existing same-language text
    /// byte-for-byte, so importing changes nothing.
    /// </summary>
    UnchangedTranslation,

    /// <summary>
    /// A problem carries no original-language body and its slug is absent from the DB — importing would insert a
    /// problem whose every text is a translation, leaving it with no canonical original. A hard conflict: a
    /// translation-only drop is only valid onto a problem that already exists.
    /// </summary>
    NoOriginalForNewProblem,

    /// <summary>
    /// A problem's slug is absent from the DB — so importing would create it — but its draft folder carries no
    /// <c>pN.yaml</c> sidecar. A fresh problem should declare its metadata; only a re-import onto an existing problem
    /// may omit it (omit = leave the stored authors/tags/link untouched). A hard conflict.
    /// </summary>
    NewProblemMissingMetadata
}

/// <summary>
/// What importing one of the draft's text variants does to a <c>(problem, document type)</c> that already exists in
/// the DB, or why the import refuses to create the problem it belongs to.
/// </summary>
/// <param name="Slug">The would-be problem slug.</param>
/// <param name="DocumentType">The document half this resolution is about (statement, solution or hints).</param>
/// <param name="Language">The language of the text variant this resolution is about.</param>
/// <param name="Action">What the import does to it.</param>
public record ProblemTextResolution(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    DraftTextAction Action)
{
    /// <summary>
    /// Whether the import refuses the text, which refuses the whole draft.
    /// </summary>
    public bool IsRefused => Action switch
    {
        DraftTextAction.SecondOriginal or DraftTextAction.NoOriginalForNewProblem
            or DraftTextAction.NewProblemMissingMetadata => true,

        DraftTextAction.AddOriginal or DraftTextAction.OverwriteOriginal or DraftTextAction.UnchangedOriginal
            or DraftTextAction.AddTranslation or DraftTextAction.OverwriteTranslation
            or DraftTextAction.UnchangedTranslation => false,

        _ => throw new ArgumentOutOfRangeException(nameof(Action), Action, "Unknown text action.")
    };
}

/// <summary>
/// What importing one draft problem would do to its problem as a whole: create it, update it because the re-import
/// changes something (<see cref="ProblemReimport.ChangesAnything"/>), or reuse it unchanged. Tallied, these are the
/// problem counts the import reports.
/// </summary>
/// <param name="Slug">The would-be problem slug.</param>
/// <param name="Action">Whether importing creates the problem, updates it in place, or leaves it as it is.</param>
/// <param name="Languages">The languages of the draft's texts for the problem, in draft order.</param>
public record ProblemResolution(
    string Slug,
    ResolutionAction Action,
    ImmutableArray<Language> Languages);

/// <summary>
/// One existing competition node whose stored sort order no longer matches its registry position — importing the
/// draft renumbers it from <see cref="FromOrder"/> to <see cref="ToOrder"/> to bring the DB back in line with
/// <c>metadata.shared.json</c>.
/// </summary>
/// <param name="Path">The node's path (e.g. <c>csmo-a-iii</c>).</param>
/// <param name="FromOrder">The sort order currently stored.</param>
/// <param name="ToOrder">The sort order the registry dictates.</param>
public record SortOrderChange(string Path, int FromOrder, int ToOrder);

/// <summary>
/// An existing competition node whose path is absent from <c>metadata.shared.json</c> — the registry can't place it,
/// so its sort order can't be reconciled and renumbering its generation would risk a collision. A hard error.
/// </summary>
/// <param name="Path">The unregistered path.</param>
public record TaxonomyOrphan(string Path);

/// <summary>
/// A round the site runs itself whose problem count would not match what its group announces once this import
/// lands. A group promises the same number of problems in every one of its competitions, and the board reads that
/// promise off the group while serving the problems off the round, so a round holding anything else breaks the
/// listing for every visitor. A hard error.
/// </summary>
/// <param name="RoundWouldHold">How many problems the round would hold once this import lands.</param>
/// <param name="GroupAnnounces"><inheritdoc cref="HostedGroup.ProblemCount" path="/summary"/></param>
public record HostedGroupCountDisagreement(int RoundWouldHold, int GroupAnnounces);

/// <summary>
/// One reason a draft problem can't be filed in the pool the way the draft says. Every one refuses the import.
/// </summary>
/// <param name="Slug">The would-be problem slug, which names the problem's place in its round.</param>
public abstract record ProposalConflict(string Slug);

/// <summary>
/// A <c>proposal:</c> block on a problem outside <see cref="HostedTaxonomy.ProposalsPath"/>, where nothing is filed.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
public record ProposalOutsidePool(string Slug) : ProposalConflict(Slug);

/// <summary>
/// A problem new to the pool with no <c>proposal:</c> block. It would land in the pool's round unfiled, so no
/// reviewer would ever see it.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
public record PoolProblemWithoutProposal(string Slug) : ProposalConflict(Slug);

/// <summary>
/// A block naming a number another problem's proposal in the same organization's pool already holds, wherever that
/// problem sits now, a deleted proposal included.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
/// <param name="Number">The number the block names.</param>
/// <param name="HolderSlug">The slug of the problem whose proposal holds the number.</param>
public record ProposalNumberTaken(string Slug, int Number, string HolderSlug) : ProposalConflict(Slug);

/// <summary>
/// A place holding a proposal the reviewers deleted. The import would rewrite its texts and leave it deleted.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
/// <param name="Number">The deleted proposal's number.</param>
public record ProposalDeleted(string Slug, int Number) : ProposalConflict(Slug);

/// <summary>
/// A place holding a proposal under a different number than the block names, so the draft describes another problem
/// than the one it would rewrite.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
/// <param name="StoredNumber">The number of the proposal at the place.</param>
/// <param name="DraftNumber">The number the block names.</param>
public record PlaceHoldsAnotherProposal(string Slug, int StoredNumber, int DraftNumber) : ProposalConflict(Slug);

/// <summary>
/// A place holding a proposal of an organization other than the draft's, which the draft may not rewrite.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
/// <param name="Number">The number of the proposal at the place.</param>
/// <param name="OrganizationSlug">The slug of the organization whose pool that proposal is in.</param>
public record PlaceHoldsAnotherPoolsProposal(string Slug, int Number, string OrganizationSlug)
    : ProposalConflict(Slug);

/// <summary>
/// A place in the pool's round holding a problem no proposal files, which the pool doesn't count as its own.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
public record PlaceHoldsNoProposal(string Slug) : ProposalConflict(Slug);

/// <summary>
/// A block recommending the problem for a category the pool's organization doesn't list.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
/// <param name="Category">The category's name, as the block gives it.</param>
/// <param name="Listed">The names of the categories the organization does list, in the order they run.</param>
public record ProposalCategoryUnknown(string Slug, string Category, IReadOnlyList<string> Listed)
    : ProposalConflict(Slug);

/// <summary>
/// A round the site runs itself whose stored embargo the draft would move. The round's group owns that instant, so the
/// draft may not move it at all: an earlier one, or none, would open a live competition's problems to everybody who
/// can sign in, spending no entry. A hard error.
/// </summary>
/// <param name="Stored">The embargo the round carries, null when it carries none, which the draft has to match.</param>
/// <param name="Draft">The embargo the draft names, null when it names none.</param>
public record HostedEmbargoDisagreement(DateTimeOffset? Stored, DateTimeOffset? Draft);

/// <summary>
/// How many of a draft's figures went to remote storage, and how many remote storage already held unchanged.
/// </summary>
/// <param name="Uploaded">How many images were pushed to remote storage.</param>
/// <param name="Skipped">How many images were skipped because their bytes were already on remote storage.</param>
public record ImageUploads(int Uploaded, int Skipped);

/// <summary>
/// What importing a draft did to the database, or would have done: it either stopped at stored taxonomy rows the
/// registry can't place, before checking anything else, or went through the whole draft.
/// </summary>
public abstract record DraftImportOutcome
{
    /// <summary>
    /// Whether the database refuses the draft, so the import kept nothing.
    /// </summary>
    public abstract bool IsRefused { get; }
}

/// <summary>
/// An import that stopped before raising the draft's path, at stored competition nodes the registry can't place:
/// renumbering their generation could collide with them, so nothing else is checked. Always a refusal, built only by
/// <see cref="IfAny"/>, so it always names at least one such node.
/// </summary>
public sealed record DraftImportStoppedAtOrphans : DraftImportOutcome
{
    /// <summary>
    /// Stops an import at the nodes given, which <see cref="IfAny"/> has checked there are some of.
    /// </summary>
    /// <param name="orphans"><inheritdoc cref="Orphans" path="/summary"/></param>
    private DraftImportStoppedAtOrphans(ImmutableArray<TaxonomyOrphan> orphans)
    {
        // The nodes the import stopped at.
        Orphans = orphans;
    }

    /// <summary>
    /// The existing competition nodes, in every generation the draft's path runs through, whose path is absent from
    /// <c>metadata.shared.json</c>.
    /// </summary>
    public ImmutableArray<TaxonomyOrphan> Orphans { get; }

    /// <inheritdoc/>
    public override bool IsRefused => true;

    /// <summary>
    /// Stops an import at the stored nodes the registry can't place, when there are any.
    /// </summary>
    /// <param name="orphans"><inheritdoc cref="Orphans" path="/summary"/></param>
    /// <returns>The stopped import, or null when every node is placed and the import goes on.</returns>
    public static DraftImportStoppedAtOrphans? IfAny(ImmutableArray<TaxonomyOrphan> orphans) =>
        // A stop for at least one node, none for a clean path
        orphans.IsDefaultOrEmpty ? null : new(orphans);
}

/// <summary>
/// What an import going through the whole draft finds: which taxonomy entities it creates, updates or reuses, whether
/// each problem is created, updated or left as it is, what happens to every text of a problem already there, and every
/// reason the database refuses the draft.
/// </summary>
/// <param name="Entities">
/// What the import does to every competition node on the draft's path, root first, then the season and the round.
/// </param>
/// <param name="TextResolutions">
/// One entry per half a draft text variant writes onto an already-existing problem slug, classifying its outcome as
/// a <see cref="DraftTextAction"/>. A net-new problem slug contributes nothing, unless it carries no original body or
/// no metadata sidecar, the net-new cases the import refuses (<see cref="DraftTextAction.NoOriginalForNewProblem"/>,
/// <see cref="DraftTextAction.NewProblemMissingMetadata"/>).
/// </param>
/// <param name="Problems">One entry per draft problem, in draft order.</param>
/// <param name="MissingProblemOrders">
/// The problem orders missing from the round once this import lands — the gaps in <c>1..N</c> of the union of the
/// orders already in the DB and the draft's orders. Empty when the round would be contiguous, and always for a round
/// under <see cref="HostedTaxonomy.ProposalsPath"/>; non-empty refuses an import that would leave (or create) a
/// gap-numbered round.
/// </param>
/// <param name="SortOrderChanges">
/// The existing competition nodes the import renumbers to match the registry — empty when the DB already agrees with
/// <c>metadata.shared.json</c>.
/// </param>
/// <param name="HostedGroupCountDisagreement">
/// How the round's post-import problem count would differ from what its group announces — null when the counts
/// agree, and null for a round no group runs.
/// </param>
/// <param name="HostedEmbargoDisagreement">
/// How the draft's embargo differs from the one stored on a round a group runs — null when they agree, and null for
/// a round no group runs.
/// </param>
/// <param name="MovesProposalsEmbargo">
/// Whether a draft for a round under <see cref="HostedTaxonomy.ProposalsPath"/> names an embargo other than
/// <see cref="HostedTaxonomy.ProposalsVisibleSince"/>, or none. False for every other round.
/// </param>
/// <param name="OrganizationProblem">
/// What is wrong with the organization the draft names, or null when nothing is.
/// </param>
/// <param name="ProposalConflicts">
/// Every reason a draft problem can't be filed in the pool the way the draft says — empty in the normal case.
/// </param>
public record DraftImportFindings(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<ProblemTextResolution> TextResolutions,
    ImmutableArray<ProblemResolution> Problems,
    ImmutableArray<int> MissingProblemOrders,
    ImmutableArray<SortOrderChange> SortOrderChanges,
    HostedGroupCountDisagreement? HostedGroupCountDisagreement,
    HostedEmbargoDisagreement? HostedEmbargoDisagreement,
    bool MovesProposalsEmbargo,
    DraftOrganizationProblem? OrganizationProblem,
    ImmutableArray<ProposalConflict> ProposalConflicts)
{
    /// <summary>
    /// Whether the database refuses the draft.
    /// </summary>
    public bool IsRefused =>
        // A text the import may not write, a gap, a broken promise of a group or the pool, an organization the draft
        // can't name, or a problem the pool won't file
        TextResolutions.Any(resolution => resolution.IsRefused)
        || !MissingProblemOrders.IsEmpty
        || HostedGroupCountDisagreement is not null
        || HostedEmbargoDisagreement is not null
        || MovesProposalsEmbargo
        || OrganizationProblem is not null
        || !ProposalConflicts.IsEmpty;
}

/// <summary>
/// An import that went through the whole draft, with what it found and the figures it pushed. Built only by
/// <see cref="SettleAsync"/>, which never lands a refused import or a dry run, so the figures are there exactly when
/// the import landed.
/// </summary>
public sealed record DraftImportFinished : DraftImportOutcome
{
    /// <summary>
    /// Pairs what the import found with the figures it pushed, the way <see cref="SettleAsync"/> decides.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="Findings" path="/summary"/></param>
    /// <param name="uploads"><inheritdoc cref="Uploads" path="/summary"/></param>
    private DraftImportFinished(DraftImportFindings findings, ImageUploads? uploads)
    {
        // What the import found.
        Findings = findings;

        // The figures the import pushed, if it landed.
        Uploads = uploads;
    }

    /// <summary>
    /// What the import found going through the draft, every refusal included.
    /// </summary>
    public DraftImportFindings Findings { get; }

    /// <summary>
    /// How many figures the import pushed and how many it skipped, null when it kept nothing.
    /// </summary>
    public ImageUploads? Uploads { get; }

    /// <inheritdoc/>
    public override bool IsRefused => Findings.IsRefused;

    /// <summary>
    /// Settles an import that went through the whole draft: a refused one goes no further, a dry run stops once
    /// flushed, and only a clean real one lands.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="Findings" path="/summary"/></param>
    /// <param name="dryRun">Whether to stop once flushed, keeping nothing.</param>
    /// <param name="flush">Writes out what the import holds pending, so the database checks it.</param>
    /// <param name="land">Keeps the import, returning the figures it pushed.</param>
    /// <returns>The settled import.</returns>
    public static async Task<DraftImportFinished> SettleAsync(
        DraftImportFindings findings, bool dryRun, Func<Task> flush, Func<Task<ImageUploads>> land)
    {
        // A refused import is neither flushed nor kept.
        if (findings.IsRefused)
            return new(findings, uploads: null);

        // Flush, so a dry run meets every constraint the database enforces, as a real one would.
        await flush();

        // A dry run has its answer once flushed, and keeps nothing.
        if (dryRun)
            return new(findings, uploads: null);

        // A clean real run lands, with the figures it pushed.
        return new(findings, await land());
    }
}

/// <summary>
/// What is wrong with the organization a draft names. Every one refuses the import.
/// </summary>
public enum DraftOrganizationProblem
{
    /// <summary>
    /// A draft for <see cref="HostedTaxonomy.ProposalsPath"/> naming no organization, so its problems would enter no
    /// organization's pool.
    /// </summary>
    Missing,

    /// <summary>
    /// A draft naming a slug no organization goes by.
    /// </summary>
    Unknown,

    /// <summary>
    /// A draft outside <see cref="HostedTaxonomy.ProposalsPath"/> naming an organization, whose pool it files nothing
    /// in.
    /// </summary>
    OutsidePool,
}
