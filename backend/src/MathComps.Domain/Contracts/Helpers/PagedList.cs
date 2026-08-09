using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Helpers;

/// <summary>
/// A page of items with paging metadata.
/// </summary>
/// <typeparam name="T">Type of the items contained within the page.</typeparam>
/// <param name="Items">Items contained in the current page.</param>
/// <param name="Page">1-based index of the current page.</param>
/// <param name="PageSize">How many items a full page holds.</param>
/// <param name="TotalCount">Total number of items across all pages.</param>
public record PagedList<T>(ImmutableList<T> Items, int Page, int PageSize, int TotalCount);
