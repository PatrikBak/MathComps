namespace MathComps.Shared.Extensions;

/// <summary>
/// Extension methods used to deal with <see cref="IEnumerable{T}"/> objects
/// </summary>
public static class EnumerableExtensions
{
    /// <summary>
    /// A fluent version of the <see cref="string.Join(string?, IEnumerable{string?})"/> method.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <param name="separator">The separator of the joined elements, by default ", ".</param>
    /// <returns>The joined string.</returns>
    public static string ToJoinedString<T>(this IEnumerable<T> enumerable, string separator = ", ")
        // A fluent version of the existing method
        => string.Join(separator, enumerable);

    /// <summary>
    /// Splits an enumerable into batches of a specified size.
    /// This is an O(n) operation that processes each element exactly once.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="source">The source enumerable to batch.</param>
    /// <param name="batchSize">The maximum size of each batch.</param>
    /// <returns>An enumerable of lists, where each list contains at most batchSize elements.</returns>
    public static IEnumerable<List<T>> Batch<T>(this IEnumerable<T> source, int batchSize)
    {
        // Validate batch size
        if (batchSize <= 0)
            throw new ArgumentException("Batch size must be greater than zero.", nameof(batchSize));

        // We'll be yielding this batch
        var batch = new List<T>(batchSize);

        // Handle each item
        foreach (var item in source)
        {
            // Let it make the batch
            batch.Add(item);

            // When batch is full...
            if (batch.Count == batchSize)
            {
                // Yield it
                yield return batch;

                // And start a new batch
                batch = new List<T>(batchSize);
            }
        }

        // Yield the last partial batch if it has any items
        if (batch.Count > 0)
            yield return batch;
    }
}
