using MathComps.Shared;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents usage statistics for a single categorized tag.
/// </summary>
/// <param name="Slug">The URL‑safe unique tag slug used for database operations.</param>
/// <param name="TagType">The category of the tag (Area, Type, Goal, or Technique).</param>
/// <param name="ProblemCount">The number of problems currently associated with this tag.</param>
public record TagUsageDto(
    string Slug,
    TagType TagType,
    int ProblemCount);
