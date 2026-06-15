using MathComps.Domain.Tagging;

namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// Tag-specific facet option that includes type categorization.
/// Extends the base FacetOption with TagType information for sectioned display in the UI.
/// </summary>
/// <param name="Slug">URL-safe identifier for the tag.</param>
/// <param name="DisplayName">Display label (human-readable tag name).</param>
/// <param name="FullName">Full display name for tooltips or details (nullable).</param>
/// <param name="Count">Number of problems associated with this tag.</param>
/// <param name="TagType">Classification of tag by conceptual role: Area, Type, Goal, or Technique.</param>
public record TagFacetOption(string Slug, string DisplayName, string? FullName, int Count, TagType TagType);
