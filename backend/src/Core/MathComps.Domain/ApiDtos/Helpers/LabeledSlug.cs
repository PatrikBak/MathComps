namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// Label and slug pair used for compact references in DTOs.
/// </summary>
/// <param name="Slug">URL-safe identifier for the label.</param>
/// <param name="DisplayName">Display name (e.g., "IMO", "EGMO").</param>
/// <param name="FullName">Full display name (e.g., "International Mathematical Olympiad").</param>
public record LabeledSlug(string Slug, string DisplayName, string? FullName = null);
