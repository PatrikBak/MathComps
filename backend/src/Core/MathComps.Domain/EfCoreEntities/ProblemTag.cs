using System.Linq.Expressions;

namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// An assignment of a tag to a problem.
/// </summary>
public class ProblemTag
{
    /// <summary>
    /// The minimum goodness of fit threshold for considering a tag assignment as valid.
    /// Tags with goodness of fit below this value are considered poor matches and are typically filtered out.
    /// </summary>
    public const float MinimumGoodnessOfFitThreshold = 0.5f;

    /// <summary>
    /// Expression predicate that determines if a problem tag has a good enough fit to be considered valid.
    /// This can be used in LINQ queries to filter out tags with poor goodness of fit.
    /// </summary>
    public static readonly Expression<Func<ProblemTag, bool>> IsGoodEnoughTag = problemTag => problemTag.GoodnessOfFit >= MinimumGoodnessOfFitThreshold;

    /// <summary>
    /// Foreign key to the problem.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>problem
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// Foreign key to the tag.
    /// </summary>
    public required Guid TagId { get; set; }

    /// <summary>
    /// Navigation to the tag.
    /// </summary>
    public Tag Tag { get; set; } = null!;

    /// <summary>
    /// Real number from 0 to 1. Either given by AI or by a human, but in the human's case
    /// it makes sense it's either 0 or 1. This number is pretty much uses only as a boolean
    /// indicator (is this a good fit or not), but for 'logging' purposes we keep the actual
    /// value from the AI.
    /// </summary>
    public required float GoodnessOfFit { get; set; }

    /// <summary>
    /// Reason given for assigning this tag to the given problem. This is used during vetoing
    /// of tags assignments. This is given by the AI and is kept for logging purposes.
    /// </summary>
    public string? Justification { get; set; }

    /// <summary>
    /// Used as follows:
    /// <list type="number">
    /// <item>The LLM suggests some tags to a problem, assigns it a confidence of 0</item>
    /// <item>
    /// We have this process of veto-ing tags. Each round of vetoing increases
    /// our confidence in the tag assignment by.
    /// For manual tag assignments, this is set to some big number (manual 
    /// assignments have 100% confidence, since the human doing the assignment 
    /// knows what they're doing).
    /// </item>
    /// </list>
    /// </summary>
    public int? Confidence { get; set; }
}
