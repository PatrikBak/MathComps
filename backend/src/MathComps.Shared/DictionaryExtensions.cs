namespace MathComps.Shared;

/// <summary>
/// Extension methods for <see cref="IDictionary{TKey,TValue}"/>.
/// </summary>
public static class DictionaryExtensions
{
    /// <summary>
    /// Gets the value corresponding to a given key , if it's present in the dictionary, or creates a new one using
    /// a given factory, adds it to the dictionary, and returns it.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="dictionary">The dictionary.</param>
    /// <param name="key">The key.</param>
    /// <param name="valueFactory">The factory for creating a new value.</param>
    /// <returns>The value from the dictionary, or a newly created one.</returns>
    public static TValue GetValueOrCreateAddAndReturn<TKey, TValue>(this IDictionary<TKey, TValue> dictionary, TKey key, Func<TValue> valueFactory)
    {
        // If the key is present, we can return the value directly
        if (dictionary.TryGetValue(key, out var value))
            return value;

        // Otherwise we let the factory create a new value
        value = valueFactory();

        // Add it to the dictionary
        dictionary.Add(key, value);

        // And return it
        return value;
    }

    /// <summary>
    /// Gets the value corresponding to a given key, if it's present in the dictionary, or creates a new one,
    /// adds it to the dictionary, and returns it.
    /// </summary>
    /// <typeparam name="TKey">The key type.</typeparam>
    /// <typeparam name="TValue">The value type.</typeparam>
    /// <param name="dictionary">The dictionary.</param>
    /// <param name="key">The key.</param>
    /// <returns>The value from the dictionary, or a newly created one.</returns>
    public static TValue GetValueOrCreateNewAddAndReturn<TKey, TValue>(this IDictionary<TKey, TValue> dictionary, TKey key) where TValue : new()
    {
        // If the key is present, we can return the value directly
        if (dictionary.TryGetValue(key, out var value))
            return value;

        // Create a new value
        value = new TValue();

        // We can add it now
        dictionary.Add(key, value);

        // And return it
        return value;
    }
}

