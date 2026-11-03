using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to recommend a proposal for one category, or take the recommendation back.
/// </summary>
/// <param name="Category">
/// The category the recommendation is for, by its <see cref="OrganizationCategory.Name"/>; null when the request
/// sent null.
/// </param>
/// <param name="IsRecommended">
/// Whether the proposal should be recommended for the category, null when the request sent null.
/// </param>
public record SetRecommendedRequest(string? Category, bool? IsRecommended);
