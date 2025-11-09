using Spectre.Console;

namespace MathComps.Shared.Cli;

/// <summary>
/// Helper class for executing operations with progress tracking using Spectre.Console.
/// Supports both parallel and sequential processing with thread-safe progress updates,
/// semaphore-controlled database access, and real-time progress visualization.
/// </summary>
public static class ProgressHelper
{
    /// <summary>
    /// Creates a concise description of a batch by showing the first and last items.
    /// Useful for displaying batch ranges like "item-1 to item-100" in progress indicators.
    /// </summary>
    /// <typeparam name="T">The type of items in the batch.</typeparam>
    /// <param name="batch">The list of items to describe.</param>
    /// <param name="itemDescription">Function that converts an item to its string representation.</param>
    /// <returns>A string showing the first item, or "first last" if batch has multiple items.</returns>
    public static string NiceBatchDescription<T>(List<T> batch, Func<T, string> itemDescription)
        // Print the first item and potentially the last too
        => $"{itemDescription(batch.First())}{(batch.Count == 1 ? "" : $" - {itemDescription(batch.Last())}")}";

    /// <summary>
    /// Executes a simple operation on a collection of items with progress tracking.
    /// Best for sequential operations where each item is processed independently without needing to return results.
    /// </summary>
    /// <typeparam name="TItem">The type of items to process.</typeparam>
    /// <param name="items">The collection of items to process.</param>
    /// <param name="progressDescription">The description to display above the progress bar.</param>
    /// <param name="processItem">The async function to process each item.</param>
    /// <param name="getItemDescription">Function to get a description of the item for progress display.</param>
    public static async Task ExecuteWithProgressAsync<TItem>(
        IReadOnlyList<TItem> items,
        string progressDescription,
        Func<TItem, string?> getItemDescription,
        Func<TItem, int, CancellationToken, Task> processItem)
    {
        // Use the universal helper
        await ExecuteWithProgressCoreAsync(
            items,
            progressDescription,
            getItemDescription,
            parallelOptions: new ParallelOptions { MaxDegreeOfParallelism = 1 },
            processItemAsync: async (item, index, ct) =>
            {
                // Here we just call the function, we don't need a result
                await processItem(item, index, ct);
                return (object?)null;
            },
            handleResultAsync: null);
    }

    /// <summary>
    /// Executes an operation on a collection of items in parallel with progress tracking and synchronized result handling.
    /// Best for parallel operations where processing produces a result that needs to be handled in a thread-safe manner.
    /// </summary>
    /// <typeparam name="TItem">The type of items to process.</typeparam>
    /// <typeparam name="TResult">The type of result returned by the processing function.</typeparam>
    /// <param name="items">The collection of items to process.</param>
    /// <param name="progressDescription">The description to display above the progress bar.</param>
    /// <param name="getItemDescription">Function to get a description of the item for progress display.</param>
    /// <param name="processItem">The async function to process each item (can run in parallel).</param>
    /// <param name="numThreads">Maximum degree of parallelism (number of threads).</param>
    /// <param name="handleResult">Optional async function to handle the result (runs in synchronized section with semaphore).</param>
    public static async Task ExecuteWithProgressInParallelAsync<TItem, TResult>(
        IReadOnlyList<TItem> items,
        string progressDescription,
        Func<TItem, string> getItemDescription,
        Func<TItem, int, CancellationToken, Task<TResult>> processItem,
        int numThreads,
        Func<TResult, TItem, int, CancellationToken, Task>? handleResult = null)
    {
        // Use the universal helper
        await ExecuteWithProgressCoreAsync(
            items,
            progressDescription,
            getItemDescription,
            parallelOptions: new ParallelOptions { MaxDegreeOfParallelism = numThreads },
            processItemAsync: processItem,
            handleResultAsync: handleResult);
    }

    /// <summary>
    /// Core implementation shared by both execute with progress functions.
    /// </summary>
    /// <typeparam name="TItem">The type of items to process.</typeparam>
    /// <typeparam name="TResult">The type of result returned by the processing function.</typeparam>
    /// <param name="items">The collection of items to process.</param>
    /// <param name="progressDescription">The description to above the progress bar.</param>
    /// <param name="getItemDescription">Function to get a description of the item for progress display.</param>
    /// <param name="parallelOptions">Options controlling the degree of parallelism.</param>
    /// <param name="processItemAsync">The async function to process each item.</param>
    /// <param name="handleResultAsync">Optional async function to handle the result in a synchronized section.</param>
    private static async Task ExecuteWithProgressCoreAsync<TItem, TResult>(
        IReadOnlyList<TItem> items,
        string progressDescription,
        Func<TItem, string?> getItemDescription,
        ParallelOptions parallelOptions,
        Func<TItem, int, CancellationToken, Task<TResult>> processItemAsync,
        Func<TResult, TItem, int, CancellationToken, Task>? handleResultAsync)
    {
        // Print the description
        AnsiConsole.MarkupLine($"\n[green]{progressDescription}[/]");

        // Spectre's progress is dope
        await AnsiConsole.Progress()
            // We can't let Spectre do UI operations because we'd lose synchronization
            .AutoRefresh(enabled: false)
            // Fancy things to display
            .Columns(
            [
                new SpinnerColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new RemainingTimeColumn(),
                new TaskDescriptionColumn(),
            ])
            .StartAsync(async progressContext =>
            {
                // Create progress task
                var processingTask = progressContext.AddTask(progressDescription, maxValue: items.Count);
                processingTask.StartTask();

                // Semaphore to ensure thread-safe database operations and progress updates
                SemaphoreSlim semaphore = new(1, 1);

                // Process items with configured parallelism
                await Parallel.ForAsync(0, items.Count, parallelOptions,
                    async (itemIndex, token) =>
                    {
                        // Get the current item to process
                        var item = items[itemIndex];

                        // Prepare the processing results
                        TResult? result = default;
                        Exception? exception = null;

                        try
                        {
                            // Process the item (parallel section)
                            result = await processItemAsync(item, itemIndex, token);
                        }
                        catch (Exception innerException)
                        {
                            // Capture exception to handle in synchronized section
                            exception = innerException;
                        }

                        // Use semaphore to ensure thread-safe database access and progress updates
                        await semaphore.WaitAsync(token);

                        try
                        {
                            // Handle exception if one occurred
                            if (exception != null)
                            {
                                // Write it nicely
                                AnsiConsole.Write(new Panel(exception.GetRenderable(ExceptionFormats.ShortenEverything))
                                    .Header($"[red]{getItemDescription(item)}[/]")
                                    .BorderColor(Color.Red)
                                    .Collapse());
                            }

                            // Handle the result if found and the handler provided
                            if (result != null && handleResultAsync != null)
                                await handleResultAsync(result, item, itemIndex, token);

                            // Update progress
                            processingTask.Increment(1);

                            // Get the item's descriptor
                            var itemDescription = getItemDescription(item);

                            // A nice description of the curent task
                            processingTask.Description =
                                $"{processingTask.Value}/{items.Count} " +
                                (itemDescription is null ? "" : $"[dim]({itemDescription})[/]");

                            // Refresh the progress
                            progressContext.Refresh();
                        }
                        finally
                        {
                            // Release the semaphore for other threads
                            semaphore.Release();
                        }
                    });

                // Mark processing phase as complete
                processingTask.StopTask();
            });
    }
}
