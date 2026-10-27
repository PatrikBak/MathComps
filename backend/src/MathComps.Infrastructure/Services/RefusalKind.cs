namespace MathComps.Infrastructure.Services;

/// <summary>
/// What kind of refusal a business failure is, seen from whoever asked. Each member is one of HTTP's client-error
/// statuses under a plain name, so picking a kind picks the status the request answers with.
/// </summary>
public enum RefusalKind
{
    /// <summary>
    /// HTTP 400 Bad Request. The request carries something the contract can't take: an empty or overlong text, a value
    /// off its scale, a part its target doesn't hold.
    /// </summary>
    Invalid,

    /// <summary>
    /// HTTP 401 Unauthorized, which in HTTP means unauthenticated. The site doesn't know who is asking: nobody is
    /// signed in, or the signed-in caller matches no user.
    /// </summary>
    Unauthenticated,

    /// <summary>
    /// HTTP 403 Forbidden. The site knows who is asking, and they may not do this, such as edit another's comment,
    /// change a paper they don't lead, or read a competition's problems without an entry.
    /// </summary>
    Forbidden,

    /// <summary>
    /// HTTP 404 Not Found. There is no such thing, or none the caller may see, which they can't tell apart.
    /// </summary>
    NotFound,

    /// <summary>
    /// HTTP 409 Conflict. The request is fine, but collides with what is already there: a username already taken, an
    /// entry already spent, a board already finalized.
    /// </summary>
    Conflict,

    /// <summary>
    /// HTTP 422 Unprocessable Content. The request is fine, but something it needs isn't true right now: the group
    /// isn't open, the profile is incomplete, the results aren't out.
    /// </summary>
    PreconditionUnmet,

    /// <summary>
    /// HTTP 429 Too Many Requests. The caller hit a cap that lifts with time, so the same request works later.
    /// </summary>
    Throttled,
}
