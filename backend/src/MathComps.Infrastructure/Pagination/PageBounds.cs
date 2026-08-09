using MathComps.Infrastructure.Options;

namespace MathComps.Infrastructure.Pagination;

/// <summary>
/// A page of results as the server will serve it: what a caller asked for, brought inside the bounds
/// <see cref="PaginationOptions"/> sets.
/// </summary>
/// <param name="PageSize">How many items the page holds.</param>
/// <param name="PageNumber">1-based index of the page.</param>
public record PageBounds(int PageSize, int PageNumber)
{
    /// <summary>
    /// How many items a query skips to land on this page.
    /// </summary>
    public int Skip => (PageNumber - 1) * PageSize;

    /// <summary>
    /// The page to serve where the server decides how big a page is and the caller only names which one it wants.
    /// </summary>
    /// <param name="options">The bounds the server enforces.</param>
    /// <param name="pageNumber">The page asked for, 1-based.</param>
    /// <returns>The page as it will be served.</returns>
    public static PageBounds ForServerPage(PaginationOptions options, int pageNumber) =>
        new(options.DefaultPageSize, BoundPageNumber(options, pageNumber));

    /// <summary>
    /// The page to serve where the caller asks for a size of its own, cut down to what the server allows.
    /// </summary>
    /// <param name="options">The bounds the server enforces.</param>
    /// <param name="pageSize">The page size asked for.</param>
    /// <param name="pageNumber">The page asked for, 1-based.</param>
    /// <returns>The page as it will be served.</returns>
    public static PageBounds ForRequestedPage(PaginationOptions options, int pageSize, int pageNumber) =>
        new(Math.Clamp(pageSize, 1, options.MaxPageSize), BoundPageNumber(options, pageNumber));

    /// <summary>
    /// Brings a page number inside the pages the server will serve, keeping the index 1-based.
    /// </summary>
    /// <param name="options">The bounds the server enforces.</param>
    /// <param name="pageNumber">The page asked for.</param>
    /// <returns>The page number to read.</returns>
    private static int BoundPageNumber(PaginationOptions options, int pageNumber) =>
        Math.Clamp(pageNumber, 1, options.MaxPageNumber);
}
