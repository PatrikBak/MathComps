namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Categorizes tags by their conceptual role in mathematical problem classification.
/// </summary>
public enum TagType
{
    /// <summary>
    /// Broad mathematical fields or disciplines (e.g., Algebra, Geometry, Number Theory).
    /// Area tags help learners identify the primary mathematical domain of a problem.
    /// </summary>
    Area = 1,

    /// <summary>
    /// Problem structures, formats, or recurring mathematical objects (e.g., Inequality, Construction Problem, Incircle).
    /// Type tags describe what kind of mathematical task or entity the problem involves.
    /// </summary>
    Type = 2,

    /// <summary>
    /// Specific solution methods, principles, or techniques (e.g., Mathematical Induction, Extremal Principle).
    /// Technique tags can only be assigned when a solution is available that demonstrates the technique.
    /// </summary>
    Technique = 3
}
