namespace MathComps.Shared;

/// <summary>
/// Extension methods used to deal with <see cref="IEnumerable{T}"/> objects
/// </summary>
public static class EnumerableExtensions
{
    /// <summary>
    /// Performs the passed action on each element of the enumerable.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <param name="action">The action to be performed on each element.</param>
    public static void ForEach<T>(this IEnumerable<T> enumerable, Action<T> action)
    {
        // Simply apply the action on each element
        foreach (var element in enumerable)
            action(element);
    }

    /// <summary>
    /// Performs the passed action on each element and its index of the enumerable.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <param name="action">The action to be performed on each element and each index.</param>
    public static void ForEach<T>(this IEnumerable<T> enumerable, Action<T, int> action)
    {
        // We'll store the index of the element to be returned here
        var index = 0;

        // Now we simply apply the action on each element and its index and increment it on the fly
        foreach (var element in enumerable)
            action(element, index++);
    }

    /// <summary>
    /// Appends the passed enumerable to the end of the enumerable.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <param name="item">The item to be concatenated.</param>
    /// <returns>The enumerable that enumerates the original one and then the passed item.</returns>
    public static IEnumerable<T> Concat<T>(this IEnumerable<T> enumerable, T item)
    {
        // Yield the existing elements
        foreach (var element in enumerable)
            yield return element;

        // And append the passed one
        yield return item;
    }

    /// <summary>
    /// Flatten the enumerable of enumerable onto a single enumerable.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <returns>The enumeration that yields the elements of the inner enumerables.</returns>
    public static IEnumerable<T> Flatten<T>(this IEnumerable<IEnumerable<T>> enumerable)
        // A simple reuse of the existing method
        => enumerable.SelectMany(_ => _);

    /// <summary>
    /// Creates an enumerable that enumerates the current one, but also with indices indicating the
    /// order of the elements.
    /// </summary>
    /// <typeparam name="T">The type of the elements of the enumerable.</typeparam>
    /// <param name="enumerable">The enumerable on which we're calling this function.</param>
    /// <returns>The original enumerable that indexes its elements.</returns>
    public static IEnumerable<(T Item, int Index)> WithIndex<T>(this IEnumerable<T> enumerable)
        // Just add the index 🙃 
        => enumerable.Select((item, index) => (item, index));

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
