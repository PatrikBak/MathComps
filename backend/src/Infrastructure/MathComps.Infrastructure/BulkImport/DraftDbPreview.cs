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
/// What importing one of the draft's text variants would do, decided from that text's originality and language
/// against the rows already present for the same <c>(problem, document type)</c>.
/// </summary>
public enum DraftTextAction
{
    /// <summary>An original text adds the first original for this document type (none present yet).</summary>
    AddOriginal,

    /// <summary>An original text replaces the existing original in the same language, in place.</summary>
    OverwriteOriginal,

    /// <summary>
    /// An original text in a different language than the existing original — importing would create a second
    /// original, which the one-original-per-document index forbids. A hard conflict.
    /// </summary>
    SecondOriginal,

    /// <summary>A translation adds a text onto the original (none in this language yet).</summary>
    AddTranslation,

    /// <summary>A translation replaces an existing same-language translation, in place.</summary>
    OverwriteTranslation
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
/// A read-only snapshot of how a draft would land in the database: which taxonomy entities already exist versus
/// would need creating, and — for every text variant whose problem slug already exists — what the import would do
/// to it given that text's language and originality. Produced by querying only — no rows written.
/// </summary>
/// <param name="Entities">Exists-or-not for the competition, season and round, in that order.</param>
/// <param name="TextResolutions">
/// One entry per draft text variant that lands on an already-existing problem slug, classifying the outcome
/// (clean add, in-place overwrite, or a second-original conflict). A net-new problem slug contributes nothing.
/// </param>
public record DraftDbPreview(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<ProblemTextResolution> TextResolutions);
