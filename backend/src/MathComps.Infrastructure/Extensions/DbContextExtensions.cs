using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Extensions;

/// <summary>
/// Extension methods for writing through a <see cref="DbContext"/>.
/// </summary>
public static class DbContextExtensions
{
    /// <summary>
    /// Replaces a set of rows wholesale: deletes the existing ones and flushes before adding the new ones, so a key
    /// both sets hold can't transiently violate its unique index within one statement batch.
    /// </summary>
    /// <typeparam name="TRow">The rows' entity type.</typeparam>
    /// <param name="context">The tracking write context.</param>
    /// <param name="existingRows">The rows to delete.</param>
    /// <param name="newRows">The rows to add once the delete is flushed.</param>
    /// <returns>A task completing once the old rows are flushed and the new ones added.</returns>
    public static async Task ReplaceRowsAsync<TRow>(
        this DbContext context, IEnumerable<TRow> existingRows, IEnumerable<TRow> newRows) where TRow : class
    {
        // Drop the old rows.
        context.Set<TRow>().RemoveRange(existingRows);

        // Flush the delete, so a key the new ones reuse is free.
        await context.SaveChangesAsync();

        // Add the replacements.
        await context.Set<TRow>().AddRangeAsync(newRows);
    }
}
