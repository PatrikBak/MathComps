using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Internal data transfer object for tag import operations.
/// This record is used to pass tag import data between the command and database service layers.
/// </summary>
/// <param name="ProblemSlug"><inheritdoc cref="Problem.Slug" path="/summary"/></param>
/// <param name="TagName"><inheritdoc cref="Tag.Name" path="/summary"/></param>
/// <param name="TagType"><inheritdoc cref="Tag.TagType" path="/summary"/></param>
/// <param name="GoodnessOfFit"><inheritdoc cref="ProblemTag.GoodnessOfFit" path="/summary"/></param>
/// <param name="Justification"><inheritdoc cref="ProblemTag.Justification" path="/summary"/></param>
/// <param name="Confidence"><inheritdoc cref="ProblemTag.Confidence" path="/summary"/></param>
public record TagImportDto(
    string ProblemSlug,
    string TagName,
    TagType TagType,
    float GoodnessOfFit,
    string? Justification,
    int? Confidence
);
