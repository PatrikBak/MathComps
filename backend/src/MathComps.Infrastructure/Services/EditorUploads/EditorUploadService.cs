using System.Collections.Immutable;
using System.Text.RegularExpressions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.EditorUploads;

/// <summary>
/// The <see cref="IEditorUploadService"/> over the <see cref="IPrivateFileLinks"/>. An upload key is
/// <c>&lt;uploader&gt;/&lt;folder&gt;/&lt;file&gt;</c>: the uploader is their Clerk user id without its <c>user_</c>
/// prefix, and the folder is the kind of file's. A file is stored under <c>user-uploads/user_</c> followed by its
/// upload key.
/// </summary>
/// <param name="fileLinks">The links to the private files.</param>
/// <param name="editorUploadSettings">The settings bounding the links one request gets.</param>
public sealed partial class EditorUploadService(
    IPrivateFileLinks fileLinks, IOptions<EditorUploadSettings> editorUploadSettings) : IEditorUploadService
{
    /// <summary>
    /// What every Clerk user id starts with, which an uploader's folder leaves off.
    /// </summary>
    private const string ClerkUserIdPrefix = "user_";

    /// <summary>
    /// What every editor upload's object key starts with, before the uploader's Clerk user id.
    /// </summary>
    private const string ObjectKeyPrefix = "user-uploads/";

    #region IEditorUploadService Implementation

    /// <inheritdoc/>
    public ImmutableDictionary<string, string> LinksIn(string text) =>
        // Every upload key named after media:, once each, with its file's link
        UploadKeyInText().Matches(text)
            .Select(match => match.Groups["key"].Value)
            .Distinct()
            .ToImmutableDictionary(key => key, key => fileLinks.LinkFor(ObjectKeyOf(key)));

    /// <inheritdoc/>
    public ImmutableDictionary<string, string> LinksToOwnUploads(string uploaderId, IEnumerable<string> keys)
    {
        // The uploader's folder, which each of their keys sits in
        var folder = FolderOf(uploaderId);

        // Only the upload keys in that folder, once each and no more than one call gets, with their file's links
        return keys
            .Where(key => UploadKey().Match(key) is { Success: true } match
                && match.Groups["uploader"].Value == folder)
            .Distinct()
            .Take(editorUploadSettings.Value.MaxOwnLinksPerRequest)
            .ToImmutableDictionary(key => key, key => fileLinks.LinkFor(ObjectKeyOf(key)));
    }

    #endregion

    #region Private Helpers

    /// <summary>
    /// The folder an uploader's files sit in.
    /// </summary>
    /// <param name="uploaderId">The uploader's Clerk user id.</param>
    /// <returns>The folder, the first part of each of their upload keys.</returns>
    private static string FolderOf(string uploaderId) =>
        // The id without what every Clerk user id starts with
        uploaderId.StartsWith(ClerkUserIdPrefix, StringComparison.Ordinal)
            ? uploaderId[ClerkUserIdPrefix.Length..]
            : throw new ArgumentException($"'{uploaderId}' is no Clerk user id.", nameof(uploaderId));

    /// <summary>
    /// The object key a file is stored under in the private bucket.
    /// </summary>
    /// <param name="key">The file's upload key.</param>
    /// <returns>The object key.</returns>
    private static string ObjectKeyOf(string key) =>
        // Under the uploads' prefix, in a folder named for the uploader's whole Clerk user id
        $"{ObjectKeyPrefix}{ClerkUserIdPrefix}{key}";

    /// <summary>
    /// Matches a whole upload key, capturing its uploader's folder.
    /// </summary>
    [GeneratedRegex("^(?<uploader>[A-Za-z0-9]+)/[a-z]+/[A-Za-z0-9._-]+$")]
    private static partial Regex UploadKey();

    /// <summary>
    /// Matches an upload key a markdown text names after <c>media:</c>, capturing the key.
    /// </summary>
    [GeneratedRegex("media:(?<key>[A-Za-z0-9]+/[a-z]+/[A-Za-z0-9._-]+)")]
    private static partial Regex UploadKeyInText();

    #endregion
}
