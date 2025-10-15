namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// Label and slug pair with an associated aggregate count.
/// Useful for facet options (e.g., tags, authors) where a count is displayed.
/// </summary>
/// <param name="Slug">URL-safe identifier for the label.</param>
/// <param name="DisplayName">Display label (human-readable).</param>
/// <param name="FullName">Full display name for tooltips or details (nullable).</param>
/// <param name="Count">Number of problems associated with this label.</param>
public record FacetOption(string Slug, string DisplayName, string? FullName, int Count);

