using System.Text.Json.Nodes;

namespace MathComps.Shared;

/// <summary>
/// General C# static utilities
/// </summary>
public static class GeneralUtilities
{
    /// <summary>
    /// Safely executes a given function while catching an exception of given type and handling it.
    /// </summary>
    /// <typeparam name="TResult">The return type of the function.</typeparam>
    /// <param name="function">The function to be executed.</param>
    /// <param name="exceptionHandler">The handler for the exception of given type. If null, then the exception is just caught.</param>
    /// <returns>Either the result of the function, if there is no exception, of the default value.</returns>
    public static TResult? TryExecute<TResult>
    (
        Func<TResult> function,
        Action<Exception>? exceptionHandler = null
    )
    {
        try
        {
            // Try to call the function
            return function();
        }
        catch (Exception e)
        {
            // Handle the exception
            exceptionHandler?.Invoke(e);

            // Return the default value
            return default;
        }
    }

    /// <inheritdoc cref="TryExecute{TResult}(Func{TResult}, Action{Exception})"/>
    public static async Task<TResult?> TryExecuteAsync<TResult>
    (
        Func<Task<TResult>> function,
        Action<Exception>? exceptionHandler = null
    )
    {
        try
        {
            // Try to call the function
            return await function();
        }
        catch (Exception e)
        {
            // Handle the exception
            exceptionHandler?.Invoke(e);

            // Return the default value
            return default;
        }
    }

    /// <summary>
    /// Compares two JSON strings semantically to determine if their content differs.
    /// Ignores formatting differences like whitespace, property order, and number representation.
    /// </summary>
    /// <param name="firstJson">The first JSON string to compare.</param>
    /// <param name="secondJson">The second JSON string to compare.</param>
    /// <returns>True if the JSON content differs; false if semantically identical.</returns>
    public static bool JsonEquals(string? firstJson, string? secondJson)
    {
        // Parse both JSON strings into comparable nodes.
        var firstNode = JsonNode.Parse(firstJson ?? "null");
        var secondNode = JsonNode.Parse(secondJson ?? "null");

        // Use deep equality comparison to detect semantic differences.
        return !JsonNode.DeepEquals(firstNode, secondNode);
    }
}
