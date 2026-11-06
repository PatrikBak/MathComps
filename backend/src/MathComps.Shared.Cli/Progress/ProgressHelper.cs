using Microsoft.Extensions.Logging;

namespace MathComps.Shared.Cli.Progress;

/// <summary>
/// Helpers for working through a list of items one at a time, logging a progress line after each item and an error
/// for each one that throws.
/// </summary>
public static class ProgressHelper
{
    /// <summary>
    /// Creates a concise description of a batch from its first and last items, like "item-1 - item-100".
    /// </summary>
    /// <typeparam name="T">The type of items in the batch.</typeparam>
    /// <param name="batch">The list of items to describe.</param>
    /// <param name="itemDescription">Function that converts an item to its string representation.</param>
    /// <returns>A string showing the first item, or "first - last" when the batch has multiple items.</returns>
    public static string NiceBatchDescription<T>(List<T> batch, Func<T, string> itemDescription)
        // Show the first item, and the last too when the batch has more than one
        => $"{itemDescription(batch.First())}{(batch.Count == 1 ? "" : $" - {itemDescription(batch.Last())}")}";

    /// <summary>
    /// Processes each item in order, logging <c>{description} {done}/{total}: {item}</c> once it is done. An item
    /// that throws is logged as an error with its exception and counts as done, and the run moves on to the next.
    /// </summary>
    /// <typeparam name="TItem">The type of items to process.</typeparam>
    /// <param name="logger">The logger the progress and failure lines go through.</param>
    /// <param name="items">The collection of items to process.</param>
    /// <param name="progressDescription">The work being done, opening every progress line.</param>
    /// <param name="getItemDescription">Describes an item in its progress and failure lines.</param>
    /// <param name="processItem">The async function to process each item.</param>
    public static async Task ExecuteWithProgressAsync<TItem>(
        ILogger logger,
        IReadOnlyList<TItem> items,
        string progressDescription,
        Func<TItem, string> getItemDescription,
        Func<TItem, Task> processItem)
    {
        // Work through the items one at a time, in order
        foreach (var (index, item) in items.Index())
        {
            try
            {
                // Process the item
                await processItem(item);
            }
            catch (Exception exception)
            {
                // Report the failed item, which still counts as done
                logger.LogError(exception, "{Item} failed", getItemDescription(item));
            }

            // Report how far the work has got
            logger.LogInformation("{Description} {Done}/{Total}: {Item}",
                progressDescription, index + 1, items.Count, getItemDescription(item));
        }
    }
}
