namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// The area of mathematics a <see cref="Proposal"/> is filed under. A paper asks one problem per area.
/// </summary>
public enum ProposalArea
{
    /// <summary>
    /// Algebra.
    /// </summary>
    Algebra,

    // ReSharper disable once UnusedMember.Global (kept: an area a proposal is filed under, read off the database)
    /// <summary>
    /// Combinatorics.
    /// </summary>
    Combinatorics,

    /// <summary>
    /// Geometry.
    /// </summary>
    Geometry,

    // ReSharper disable once UnusedMember.Global (kept: an area a proposal is filed under, read off the database)
    /// <summary>
    /// Number theory.
    /// </summary>
    NumberTheory,
}
