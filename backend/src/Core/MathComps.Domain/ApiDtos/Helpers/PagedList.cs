using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.Helpers;

/// <summary>
/// A page of items with paging metadata.
/// </summary>
/// <typeparam name="T">Type of the items contained within the page.</typeparam>
/// <param name="Items">Items contained in the current page.</param>
/// <param name="Page">1-based index of the current page.</param>
/// <param name="PageSize">Requested number of items per page.</param>
/// <param name="TotalCount">Total number of items across all pages.</param>
public record PagedList<T>(ImmutableList<T> Items, int Page, int PageSize, int TotalCount)
{
    /// <summary>
    /// Total number of available pages derived from <paramref name="TotalCount"/> and <paramref name="PageSize"/>.
    /// Returns 0 when <paramref name="PageSize"/> is not positive.
    /// </summary>
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
}
