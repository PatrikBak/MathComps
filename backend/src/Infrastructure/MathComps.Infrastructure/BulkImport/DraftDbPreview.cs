using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Whether a taxonomy entity the draft references already exists (so it would be reused) or is missing (so it
/// would need creating).
/// </summary>
public enum ResolutionAction
{
    /// <summary>The entity already exists in the DB and would be reused.</summary>
    Reuse,

    /// <summary>The entity is absent and would need to be created.</summary>
    Create
}

/// <summary>
/// The exists-or-not outcome for a single taxonomy entity the draft references.
/// </summary>
/// <param name="EntityKind">The kind of entity (<c>competition</c>, <c>season</c>, <c>round</c>).</param>
/// <param name="Identifier">The lookup key — a slug, composite slug, or year.</param>
/// <param name="Action">Whether the entity already exists (reuse) or would need creating.</param>
public record EntityResolution(
    string EntityKind,
    string Identifier,
    ResolutionAction Action);

/// <summary>
/// What importing the draft would do to one existing problem text, decided from the draft's
/// original-vs-translation flag and language against the rows already present for that
/// <c>(problem, document type)</c>.
/// </summary>
public enum DraftTextAction
{
    /// <summary>An original draft adds the first original for this document type (none present yet).</summary>
    AddOriginal,

    /// <summary>An original draft replaces the existing original in the same language, in place.</summary>
    OverwriteOriginal,

    /// <summary>
    /// An original draft in a different language than the existing original — importing would create a second
    /// original, which the one-original-per-document index forbids. A hard conflict.
    /// </summary>
    SecondOriginal,

    /// <summary>A translation draft adds a translation onto an existing original (none in this language yet).</summary>
    AddTranslation,

    /// <summary>A translation draft replaces an existing same-language translation, in place.</summary>
    OverwriteTranslation,

    /// <summary>
    /// A translation draft with no existing original to attach to (the problem or its original document is
    /// absent) — the translation would dangle with no original. A hard conflict.
    /// </summary>
    OrphanTranslation
}

/// <summary>
/// What importing the draft would do to one <c>(problem, document type)</c> that already exists in the DB.
/// </summary>
/// <param name="Slug">The would-be problem slug that already exists.</param>
/// <param name="DocumentType">The document half this resolution is about (statement or solution).</param>
/// <param name="Language">The language the draft would write for this half.</param>
/// <param name="Action">What the import would do to it.</param>
public record ProblemTextResolution(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    DraftTextAction Action);

/// <summary>
/// A read-only snapshot of how a draft would land in the database: which taxonomy entities already exist versus
/// would need creating, and — for every problem half whose problem slug already exists — what the import would do
/// to it given the draft's language and original-vs-translation flag. Produced by querying only — no rows written.
/// </summary>
/// <param name="Entities">Exists-or-not for the competition, season and round, in that order.</param>
/// <param name="TextResolutions">
/// One entry per draft half that lands on an already-existing problem slug, classifying the outcome (clean add,
/// in-place overwrite, or a hard conflict). A net-new problem slug contributes nothing here.
/// </param>
public record DraftDbPreview(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<ProblemTextResolution> TextResolutions);
