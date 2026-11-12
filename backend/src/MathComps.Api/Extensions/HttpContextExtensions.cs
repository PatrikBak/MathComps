namespace MathComps.Api.Extensions;

/// <summary>
/// Extension members reading and naming the account a request acts for.
/// </summary>
internal static class HttpContextExtensions
{
    /// <summary>
    /// The key a request's items hold the Clerk id of its credential's owner under.
    /// </summary>
    private static readonly object _credentialOwnerKey = new();

    extension(HttpContext context)
    {
        /// <summary>
        /// The Clerk id of the account a credential other than a sign-in lets the request act for. Null on a request
        /// carrying none that resolves.
        /// </summary>
        public string? CredentialOwnerClerkId
        {
            get => context.Items[_credentialOwnerKey] as string;
            set => context.Items[_credentialOwnerKey] = value;
        }

        /// <summary>
        /// The Clerk id of the account the request acts for: the signed-in caller's, or else the one its other
        /// credential names. Null on an anonymous request.
        /// </summary>
        public string? CallerClerkId => context.User.ClerkId ?? context.CredentialOwnerClerkId;
    }
}
