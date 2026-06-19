using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

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
/// <param name="EntityKind">The kind of entity (<c>competition</c>, <c>category</c>, <c>round</c>, <c>season</c>,
/// <c>round-instance</c>).</param>
/// <param name="Identifier">The lookup key — a slug, composite slug, or year.</param>
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
/// <param name="DocumentType">The document half this resolution is about (statement or solution).</param>
/// <param name="Language">The language of the text variant this resolution is about.</param>
/// <param name="Action">What the import would do to it.</param>
public record ProblemTextResolution(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    DraftTextAction Action);

/// <summary>
/// A taxonomy family whose sort order the registry defines and apply reconciles.
/// </summary>
public enum TaxonomyKind
{
    /// <summary>A competition — a global sort-order space.</summary>
    Competition,

    /// <summary>A category — a global sort-order space.</summary>
    Category,

    /// <summary>A round — a per-competition sort-order space.</summary>
    Round
}

/// <summary>
/// One existing taxonomy row whose stored sort order no longer matches its registry position — applying the draft
/// renumbers it from <see cref="FromOrder"/> to <see cref="ToOrder"/> to bring the DB back in line with
/// <c>metadata.shared.json</c>.
/// </summary>
/// <param name="Kind">The kind of taxonomy entity.</param>
/// <param name="Slug">The entity's slug (a round's plain slug).</param>
/// <param name="FromOrder">The sort order currently stored.</param>
/// <param name="ToOrder">The sort order the registry dictates.</param>
public record SortOrderChange(TaxonomyKind Kind, string Slug, int FromOrder, int ToOrder);

/// <summary>
/// An existing taxonomy row whose slug is absent from <c>metadata.shared.json</c> — the registry can't place it,
/// so its sort order can't be reconciled and apply would risk a collision. A hard error.
/// </summary>
/// <param name="Kind">The kind of taxonomy entity.</param>
/// <param name="Slug">The unregistered slug.</param>
public record TaxonomyOrphan(TaxonomyKind Kind, string Slug);

/// <summary>
/// A read-only snapshot of how a draft would land in the database: which taxonomy entities already exist versus
/// would need creating, and — for every text variant whose problem slug already exists — what the import would do
/// to it given that text's language and originality. Produced by querying only — no rows written.
/// </summary>
/// <param name="Entities">Exists-or-not for the competition, season and round, in that order.</param>
/// <param name="TextResolutions">
/// One entry per draft text variant that lands on an already-existing problem slug, classifying the outcome
/// (clean add, in-place overwrite, or a second-original conflict). A net-new problem slug contributes nothing —
/// unless it carries no original body or no metadata sidecar, the net-new cases worth flagging
/// (<see cref="DraftTextAction.NoOriginalForNewProblem"/>, <see cref="DraftTextAction.NewProblemMissingMetadata"/>).
/// </param>
/// <param name="MissingProblemOrders">
/// The problem orders missing from the round once this import lands — the gaps in <c>1..N</c> of the union of the
/// orders already in the DB and the draft's orders. Empty when the round would be contiguous; non-empty flags an
/// import that would leave (or create) a gap-numbered round.
/// </param>
/// <param name="SortOrderChanges">
/// The existing competition, category and round rows whose stored sort order applying the draft would renumber to
/// match the registry — empty when the DB already agrees with <c>metadata.shared.json</c>.
/// </param>
/// <param name="Orphans">
/// The existing competition, category and round rows whose slug is absent from <c>metadata.shared.json</c> — empty
/// in the normal case; non-empty blocks the import.
/// </param>
public record DraftDbPreview(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<ProblemTextResolution> TextResolutions,
    ImmutableArray<int> MissingProblemOrders,
    ImmutableArray<SortOrderChange> SortOrderChanges,
    ImmutableArray<TaxonomyOrphan> Orphans);
