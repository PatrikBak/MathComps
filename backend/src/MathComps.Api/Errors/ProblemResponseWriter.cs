namespace MathComps.Api.Errors;

/// <summary>
/// Writes an RFC 9457 problem response carrying a machine-readable <c>errorCode</c>, so every coded
/// failure is emitted in one shape whether it came from a business exception or from middleware.
/// </summary>
public static class ProblemResponseWriter
{
    /// <summary>
    /// Sets the status and writes the problem body with the given <paramref name="code"/>.
    /// </summary>
    /// <param name="problemDetailsService">Writes the RFC 9457 problem body.</param>
    /// <param name="httpContext">The current request.</param>
    /// <param name="status">The HTTP status to return.</param>
    /// <param name="code">The machine-readable failure code.</param>
    /// <param name="detail">A human-readable detail, or <c>null</c> to omit it.</param>
    /// <param name="exception">The originating exception, when one exists, for the problem context.</param>
    /// <returns>Whether the problem body was written (a writer may decline, e.g. on an Accept mismatch).</returns>
    public static async ValueTask<bool> WriteAsync(
        IProblemDetailsService problemDetailsService,
        HttpContext httpContext,
        int status,
        ApiErrorCode code,
        string? detail = null,
        Exception? exception = null)
    {
        // Set the status
        httpContext.Response.StatusCode = status;

        // Surface the status, detail, and the machine-readable code
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails =
            {
                Status = status,
                Detail = detail,
                Extensions = { ["errorCode"] = code.ToString() }
            }
        });
    }
}
