using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Dtos;

public record ProblemTagData(
    TagType TagType,
    float GoodnessOfFit,
    string? Justification = null,
    int? Confidence = null);
