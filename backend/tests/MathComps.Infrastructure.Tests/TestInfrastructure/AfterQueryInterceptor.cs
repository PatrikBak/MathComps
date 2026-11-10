using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A command interceptor that runs a step once, right after the first query read through an async data reader whose
/// SQL holds every given fragment has run, so a test can change the database between two statements of the code under
/// test.
/// </summary>
/// <param name="step">What runs, before the query's rows are read.</param>
/// <param name="fragments">Pieces of text the query's SQL must hold, every one of them.</param>
internal sealed class AfterQueryInterceptor(Func<Task> step, params string[] fragments) : DbCommandInterceptor
{
    /// <summary>
    /// Whether the step has run, as 1 once it has.
    /// </summary>
    private int _ran;

    /// <inheritdoc/>
    public override async ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        // The first query holding every fragment runs the step
        if (fragments.All(fragment => command.CommandText.Contains(fragment, StringComparison.Ordinal))
            && Interlocked.Exchange(ref _ran, 1) == 0)
            await step();

        // The query's rows, untouched
        return result;
    }
}
