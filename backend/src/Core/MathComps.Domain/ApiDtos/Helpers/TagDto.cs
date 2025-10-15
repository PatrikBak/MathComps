using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// Tag information for API responses including type categorization.
/// </summary>
/// <param name="Slug">URL-safe identifier for the tag.</param>
/// <param name="DisplayName">Display label (human-readable tag name).</param>
/// <param name="TagType">Classification of tag by conceptual role: Area, Type, or Technique.</param>
public record TagDto(string Slug, string DisplayName, TagType TagType);
