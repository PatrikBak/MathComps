using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// The made-up R2 account the tests sign links to the private bucket with. Signing a link makes no call, so the links
/// come out as R2 would take them, and nothing ever reaches R2 with them.
/// </summary>
internal static class TestR2
{
    /// <summary>
    /// The account's <see cref="R2Settings.AccountId"/>.
    /// </summary>
    public const string AccountId = "test-account";

    /// <summary>
    /// The account's <see cref="R2Settings.AccessKeyId"/>.
    /// </summary>
    public const string AccessKeyId = "test-access-key";

    /// <summary>
    /// The account's <see cref="R2Settings.SecretAccessKey"/>.
    /// </summary>
    public const string SecretAccessKey = "test-secret-key";

    /// <summary>
    /// The account's <see cref="R2Settings.PrivateBucketName"/>.
    /// </summary>
    public const string PrivateBucketName = "test-private";

    /// <summary>
    /// The account's settings, naming the private bucket alone.
    /// </summary>
    public static R2Settings Settings => new()
    {
        AccountId = AccountId,
        AccessKeyId = AccessKeyId,
        SecretAccessKey = SecretAccessKey,
        PrivateBucketName = PrivateBucketName,
    };

    /// <summary>
    /// Where a signed link reads a private file from, everything before the link's query.
    /// </summary>
    /// <param name="objectKey">The file's object key.</param>
    /// <returns>The file's address in the private bucket.</returns>
    public static string PrivateFileAddress(string objectKey) =>
        // The account's host, then the bucket and the key as the path
        $"https://{AccountId}.r2.cloudflarestorage.com/{PrivateBucketName}/{objectKey}";
}
