using MathComps.Api.Errors;
using MathComps.Api.Extensions;
using MathComps.Infrastructure.Services;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Shared.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that <see cref="GlobalExceptionHandler"/> answers every business exception, meaning every
/// <see cref="MathCompsException"/>, with a client status and the code named after its type, and logs each at the
/// level it states. Also guards that a note an exception carries for the log reaches its line and never the response,
/// and the one failure that never reaches a service: a request body the framework itself refused.
/// </summary>
public class GlobalExceptionHandlerTests
{
    /// <summary>
    /// One of every business exception the services and the endpoints throw.
    /// </summary>
    private static readonly MathCompsException[] _businessExceptions =
        [.. BusinessExceptions.Types.Select(CreateException)];

    /// <summary>
    /// Every business exception maps to a client status (not a 500) and stamps its wire code.
    /// </summary>
    [Fact]
    public async Task Every_business_exception_maps_to_a_client_status_and_code()
    {
        // Drive each one through the real handler
        foreach (var exception in _businessExceptions)
        {
            // Capture what the handler asks to write for this exception
            var problemDetails = new CapturingProblemDetailsService();
            var handler = new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance, problemDetails);
            var httpContext = new DefaultHttpContext();

            // Handle the exception as the pipeline would when it escapes an endpoint
            await handler.TryHandleAsync(httpContext, exception, CancellationToken.None);

            // A recognized failure maps to a client status, never the unexpected-fault 500
            Assert.True(
                httpContext.Response.StatusCode != StatusCodes.Status500InternalServerError,
                $"{exception.GetType().Name} reaches the client as a 500, the way an unexpected fault does.");

            // ...and carries the wire code named after the exception
            Assert.Equal(
                BusinessExceptions.CodeOf(exception.GetType()), problemDetails.Written?.Extensions["errorCode"]);
        }
    }

    /// <summary>
    /// The handler logs every business exception once at exactly the level it states. The exception rides along,
    /// which is what gives an issue in error tracking its stack and its grouping.
    /// </summary>
    [Fact]
    public async Task Every_business_exception_is_logged_once_at_the_level_it_states()
    {
        // Drive each one through the real handler
        foreach (var exception in _businessExceptions)
        {
            // Capture what the handler logs for it
            var logger = new FakeLogger<GlobalExceptionHandler>();
            var handler = new GlobalExceptionHandler(logger, new CapturingProblemDetailsService());

            // Handle the exception as the pipeline would when it escapes an endpoint
            await handler.TryHandleAsync(new DefaultHttpContext(), exception, CancellationToken.None);

            // The handler writes exactly one line for it
            var record = Assert.Single(logger.Collector.GetSnapshot());

            // ...at the level the exception states
            Assert.True(
                record.Level == exception.LogLevel,
                $"{exception.GetType().Name} states {exception.LogLevel} but was logged at {record.Level}.");

            // ...carrying the exception itself
            Assert.Same(exception, record.Exception);
        }
    }

    /// <summary>
    /// What an exception adds for the log lands in its one line, a business refusal's and an unexpected fault's alike,
    /// and never in what the caller is sent.
    /// </summary>
    [Fact]
    public async Task What_an_exception_adds_for_the_log_reaches_its_line_and_not_the_caller()
    {
        // The note a failure carries for whoever debugs it
        const string note = "the upload is kept at defense/photos/failed/x";

        // A refusal the handler answers, and a fault it doesn't recognize
        Exception[] failures = [new UnreadablePhotoException(), new InvalidOperationException("The reading failed")];

        // Drive each one through the real handler
        foreach (var failure in failures)
        {
            // Put the note on the failure
            failure.LogDetail = note;

            // Capture what the handler logs and asks to write
            var logger = new FakeLogger<GlobalExceptionHandler>();
            var problemDetails = new CapturingProblemDetailsService();
            var handler = new GlobalExceptionHandler(logger, problemDetails);

            // Handle it as the pipeline would
            await handler.TryHandleAsync(new DefaultHttpContext(), failure, CancellationToken.None);

            // Its one line carries the note
            Assert.Contains(note, Assert.Single(logger.Collector.GetSnapshot()).Message);

            // ...and the caller is sent none of it
            Assert.DoesNotContain(note, problemDetails.Written?.Detail ?? "");
        }
    }

    /// <summary>
    /// A body the framework couldn't build the route's parameter from is the caller's fault, so it keeps the
    /// status the framework already judged rather than being reported as a fault of ours. It states no level
    /// of its own, so it logs at Error like every exception that isn't a <see cref="MathCompsException"/>.
    /// </summary>
    [Fact]
    public async Task A_body_the_framework_refused_stays_the_callers_fault()
    {
        // Capture what the handler logs and asks to write
        var logger = new FakeLogger<GlobalExceptionHandler>();
        var problemDetails = new CapturingProblemDetailsService();
        var handler = new GlobalExceptionHandler(logger, problemDetails);
        var httpContext = new DefaultHttpContext();

        // This is what reading a malformed JSON body throws before any endpoint runs
        var refusal = new BadHttpRequestException("Failed to read parameter from the request body as JSON.",
            StatusCodes.Status400BadRequest);

        // Handle it as the pipeline would
        await handler.TryHandleAsync(httpContext, refusal, CancellationToken.None);

        // The framework's own status carries through instead of being downgraded to an unexpected fault
        Assert.Equal(StatusCodes.Status400BadRequest, httpContext.Response.StatusCode);

        // ...under the code that says the body was the problem
        Assert.Equal(nameof(ApiErrorCode.MalformedRequest), problemDetails.Written?.Extensions["errorCode"]);

        // ...and logged once, at Error
        Assert.Equal(LogLevel.Error, Assert.Single(logger.Collector.GetSnapshot()).Level);
    }

    /// <summary>
    /// Instantiates an exception via its fewest-argument constructor, filling parameters with placeholders.
    /// </summary>
    /// <param name="exceptionType">The exception type to construct.</param>
    /// <returns>A constructed instance of the exception.</returns>
    private static MathCompsException CreateException(Type exceptionType)
    {
        // Pick the smallest constructor the compiler generated for the primary declaration
        var constructor = exceptionType.GetConstructors().MinBy(candidate => candidate.GetParameters().Length)!;

        // A string parameter is a slug or an id the message quotes, and no assertion reads the message, so "x"
        // serves for every one. A value type, such as the kind of comment target, takes its default.
        var arguments = constructor.GetParameters()
            .Select(parameter => parameter.ParameterType == typeof(string)
                ? "x"
                : Activator.CreateInstance(parameter.ParameterType)!)
            .ToArray();

        // Build the instance
        return (MathCompsException)constructor.Invoke(arguments);
    }

    /// <summary>
    /// An <see cref="IProblemDetailsService"/> that records the problem details it is asked to write
    /// instead of serializing them to a response.
    /// </summary>
    private sealed class CapturingProblemDetailsService : IProblemDetailsService
    {
        /// <summary>The problem details the handler last asked to write.</summary>
        public ProblemDetails? Written { get; private set; }

        /// <inheritdoc />
        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context)
        {
            // Record the payload
            Written = context.ProblemDetails;

            // Report a successful write
            return ValueTask.FromResult(true);
        }

        /// <inheritdoc />
        public ValueTask WriteAsync(ProblemDetailsContext context)
        {
            // Record the payload
            Written = context.ProblemDetails;

            // Nothing to report back
            return ValueTask.CompletedTask;
        }
    }
}
