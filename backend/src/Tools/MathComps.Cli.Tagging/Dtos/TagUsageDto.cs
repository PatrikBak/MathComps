using MathComps.Domain.EfCoreEntities;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents usage statistics for a single categorized tag.
/// </summary>
/// <param name="Id">The unique identifier of the tag.</param>
/// <param name="Name">The human‑readable tag name.</param>
/// <param name="Slug">The URL‑safe unique tag slug.</param>
/// <param name="TagType">The category of the tag (Area, Type, or Technique).</param>
/// <param name="ProblemCount">The number of problems currently associated with this tag.</param>
public record TagUsageDto(
    Guid Id,
    string Name,
    string Slug,
    TagType TagType,
    int ProblemCount);


