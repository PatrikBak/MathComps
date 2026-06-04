using System.Collections.Immutable;

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
/// A read-only snapshot of how a draft would land in the database: which taxonomy entities already exist versus
/// would need creating, and which problem slugs are already taken. Produced by querying only — no rows written.
/// </summary>
/// <param name="Entities">Exists-or-not for the competition, season and round, in that order.</param>
/// <param name="CollidingProblemSlugs">
/// Would-be problem slugs that already exist in the DB — importing the draft would overwrite these in place, so
/// a surprise clash is worth surfacing.
/// </param>
public record DraftDbPreview(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<string> CollidingProblemSlugs);
