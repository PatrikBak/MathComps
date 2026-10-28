namespace MathComps.Api.Errors;

/// <summary>
/// Machine-readable identifier for a failure the API refuses before any business exception is involved, emitted in a
/// problem response's <c>errorCode</c> field. A business exception's code is its own type's name instead.
/// </summary>
public enum ApiErrorCode
{
    /// <summary>
    /// The request body could not be read into what the route expects: broken JSON, a field of the wrong
    /// type, a value no member of an enumeration names, a required field left out, or no body at all.
    /// </summary>
    MalformedRequest,

    /// <summary>
    /// The request reached an authenticated endpoint without a valid bearer token (missing, malformed,
    /// or expired).
    /// </summary>
    Unauthenticated,

    /// <summary>
    /// The caller is authenticated but lacks the role or policy the endpoint requires.
    /// </summary>
    Forbidden,

    /// <summary>
    /// The caller exceeded a rate limit and should retry later.
    /// </summary>
    RateLimited
}
