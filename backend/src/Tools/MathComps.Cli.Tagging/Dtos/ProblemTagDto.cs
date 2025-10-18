using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents tag data associated with a problem.
/// </summary>
/// <param name="TagType"><inheritdoc cref="Tag.TagType" path="/summary"/></param>
/// <param name="GoodnessOfFit"><inheritdoc cref="ProblemTag.GoodnessOfFit" path="/summary"/></param>
/// <param name="Justification"><inheritdoc cref="ProblemTag.Justification" path="/summary"/></param>
/// <param name="Confidence"><inheritdoc cref="ProblemTag.Confidence" path="/summary"/></param>
public record ProblemTagData(
    TagType TagType,
    float GoodnessOfFit,
    string? Justification = null,
    int? Confidence = null)
{
    /// <summary>
    /// Indicates whether the tag is approved based on its goodness of fit.   
    /// </summary>
    public bool IsApproved => GoodnessOfFit >= ProblemTag.MinimumGoodnessOfFitThreshold;
}
