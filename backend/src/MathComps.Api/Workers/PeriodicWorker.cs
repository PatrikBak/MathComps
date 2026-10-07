namespace MathComps.Api.Workers;

/// <summary>
/// A background loop running one pass of its work at startup, then one every interval for as long as the API runs. A
/// failed pass is reported and the loop carries on.
/// </summary>
/// <param name="interval">How long apart the passes start.</param>
/// <param name="logger">The logger the failed passes are reported to.</param>
public abstract class PeriodicWorker(TimeSpan interval, ILogger logger) : BackgroundService
{
    /// <summary>
    /// Runs one pass of the work.
    /// </summary>
    /// <param name="now">The instant the pass runs at.</param>
    /// <param name="cancellationToken">A token cancelled when the API stops.</param>
    protected abstract Task RunPassAsync(DateTimeOffset now, CancellationToken cancellationToken);

    /// <inheritdoc/>
    protected sealed override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // The beat the passes run to
        using var timer = new PeriodicTimer(interval);

        // Whether the pass before failed, so a failure lasting many passes is reported as an error once
        var lastPassFailed = false;

        // One pass at startup, then one per beat until the API stops
        do
        {
            try
            {
                // One pass
                await RunPassAsync(DateTimeOffset.UtcNow, stoppingToken);

                // The pass went through
                lastPassFailed = false;
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                // The failure, the first of a run of them as an error and the rest as warnings
                logger.Log(
                    lastPassFailed ? LogLevel.Warning : LogLevel.Error,
                    exception,
                    "A pass of {Worker} failed",
                    GetType().Name);

                // The next pass knows this one failed
                lastPassFailed = true;
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
