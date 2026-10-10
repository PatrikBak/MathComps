using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// What resolving a taxonomy entity the draft references does to it: reuse it unchanged, update it in place when a
/// field differs, or create it when it is absent.
/// </summary>
public enum ResolutionAction
{
    /// <summary>The entity already exists in the DB and is reused unchanged.</summary>
    Reuse,

    /// <summary>The entity already exists but a field differs from the draft, so it is updated in place.</summary>
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
    /// <summary>An original text adds the first original for this document type (none present yet).</summary>
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

    /// <summary>A translation replaces an existing same-language translation, in place.</summary>
    OverwriteTranslation,

    /// <summary>A translation matches the existing same-language text byte-for-byte — importing changes nothing.</summary>
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
/// What importing one of the draft's text variants would do to a <c>(problem, document type)</c> that already
/// exists in the DB.
/// </summary>
/// <param name="Slug">The would-be problem slug that already exists.</param>
/// <param name="DocumentType">The document half this resolution is about (statement, solution or hints).</param>
/// <param name="Language">The language of the text variant this resolution is about.</param>
/// <param name="Action">What the import would do to it.</param>
public record ProblemTextResolution(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    DraftTextAction Action);

/// <summary>
/// One existing competition node whose stored sort order no longer matches its registry position — applying the draft
/// renumbers it from <see cref="FromOrder"/> to <see cref="ToOrder"/> to bring the DB back in line with
/// <c>metadata.shared.json</c>.
/// </summary>
/// <param name="Path">The node's path (e.g. <c>csmo-a-iii</c>).</param>
/// <param name="FromOrder">The sort order currently stored.</param>
/// <param name="ToOrder">The sort order the registry dictates.</param>
public record SortOrderChange(string Path, int FromOrder, int ToOrder);

/// <summary>
/// An existing competition node whose path is absent from <c>metadata.shared.json</c> — the registry can't place it,
/// so its sort order can't be reconciled and apply would risk a collision. A hard error.
/// </summary>
/// <param name="Path">The unregistered path.</param>
public record TaxonomyOrphan(string Path);

/// <summary>
/// One stored text a re-import would rewrite on a problem students have already defended. Apply matches a problem by
/// slug and overwrites its texts under the same id, so a draft regenerated after the problems were rearranged
/// rewrites the text under an id every defense of the old problem still points at.
/// </summary>
/// <param name="Slug">The problem slug whose text would change.</param>
/// <param name="DocumentType">The half that would change (statement or solution; hints never count).</param>
/// <param name="Language">The language of the text variant that would change.</param>
/// <param name="DefenseCount">How many defenses the problem already carries.</param>
public record DefendedProblemRestatement(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    int DefenseCount);

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
/// A block naming a number another problem's proposal already holds, wherever that problem sits now, a deleted
/// proposal included.
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
/// A place in the pool's round holding a problem no proposal files, which the pool doesn't count as its own.
/// </summary>
/// <param name="Slug"><inheritdoc cref="ProposalConflict.Slug" path="/summary"/></param>
public record PlaceHoldsNoProposal(string Slug) : ProposalConflict(Slug);

/// <summary>
/// A read-only snapshot of how a draft would land in the database: which taxonomy entities already exist versus
/// would need creating, and — for every text variant whose problem slug already exists — what the import would do
/// to it given that text's language and originality. Produced by querying only — no rows written.
/// </summary>
/// <param name="Entities">Exists-or-not for the competition node, season and round, in that order.</param>
/// <param name="TextResolutions">
/// One entry per draft text variant that lands on an already-existing problem slug, classifying the outcome
/// (clean add, in-place overwrite, or a second-original conflict). A net-new problem slug contributes nothing —
/// unless it carries no original body or no metadata sidecar, the net-new cases worth flagging
/// (<see cref="DraftTextAction.NoOriginalForNewProblem"/>, <see cref="DraftTextAction.NewProblemMissingMetadata"/>).
/// </param>
/// <param name="MissingProblemOrders">
/// The problem orders missing from the round once this import lands — the gaps in <c>1..N</c> of the union of the
/// orders already in the DB and the draft's orders. Empty when the round would be contiguous, and always for a round
/// under <see cref="HostedTaxonomy.ProposalsPath"/>; non-empty flags an import that would leave (or create) a
/// gap-numbered round.
/// </param>
/// <param name="SortOrderChanges">
/// The existing competition nodes whose stored sort order applying the draft would renumber to match the registry —
/// empty when the DB already agrees with <c>metadata.shared.json</c>.
/// </param>
/// <param name="Orphans">
/// The existing competition nodes whose path is absent from <c>metadata.shared.json</c> — empty in the normal case;
/// non-empty blocks the import.
/// </param>
/// <param name="DefendedProblemRestatements">
/// The texts this import would rewrite on problems that already carry a defense — empty in the normal case.
/// </param>
/// <param name="HostedGroupCountDisagreement">
/// How the round's post-import problem count would differ from what its group announces — null when the counts
/// agree, and null for a round no group runs.
/// </param>
/// <param name="MovesProposalsEmbargo">
/// Whether a draft for a round under <see cref="HostedTaxonomy.ProposalsPath"/> names an embargo other than
/// <see cref="HostedTaxonomy.ProposalsVisibleSince"/>, or none. False for every other round.
/// </param>
/// <param name="ProposalConflicts">
/// Every reason a draft problem can't be filed in the pool the way the draft says — empty in the normal case.
/// </param>
public record DraftDbPreview(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<ProblemTextResolution> TextResolutions,
    ImmutableArray<int> MissingProblemOrders,
    ImmutableArray<SortOrderChange> SortOrderChanges,
    ImmutableArray<TaxonomyOrphan> Orphans,
    ImmutableArray<DefendedProblemRestatement> DefendedProblemRestatements,
    HostedGroupCountDisagreement? HostedGroupCountDisagreement,
    bool MovesProposalsEmbargo,
    ImmutableArray<ProposalConflict> ProposalConflicts);
