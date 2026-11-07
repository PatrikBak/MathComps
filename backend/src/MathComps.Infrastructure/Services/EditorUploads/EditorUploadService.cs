using System.Collections.Immutable;
using System.Net.Mime;
using System.Text.RegularExpressions;
using System.Text.Unicode;
using MathComps.Domain.Contracts.EditorUploads;
using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Extensions;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.EditorUploads;

/// <summary>
/// The <see cref="IEditorUploadService"/> and the <see cref="IEditorUploadLinks"/> over the
/// <see cref="IPrivateObjectStore"/> and its <see cref="IPrivateFileLinks"/>. An upload key is
/// <c>&lt;uploader&gt;/&lt;folder&gt;/&lt;file&gt;</c>: the uploader is their Clerk user id without its <c>user_</c>
/// prefix, and the folder is the kind of file's. A file is stored under <c>user-uploads/user_</c> followed by its
/// upload key, and named by when it went up and a uuid, with the extension of the format its bytes are.
/// </summary>
/// <param name="objectStore">The private store the files go into.</param>
/// <param name="fileLinks">The links to the private files.</param>
/// <param name="editorUploadSettings">The settings bounding how big a file may be and how many links one request
/// gets.</param>
public sealed partial class EditorUploadService(
    IPrivateObjectStore objectStore,
    IPrivateFileLinks fileLinks,
    IOptions<EditorUploadSettings> editorUploadSettings) : IEditorUploadService, IEditorUploadLinks
{
    /// <summary>
    /// What every Clerk user id starts with, which an uploader's folder leaves off.
    /// </summary>
    private const string ClerkUserIdPrefix = "user_";

    /// <summary>
    /// What every editor upload's object key starts with, before the uploader's Clerk user id.
    /// </summary>
    private const string ObjectKeyPrefix = "user-uploads/";

    /// <summary>
    /// The media type parameter a text is served with, saying how its bytes read.
    /// </summary>
    private const string Utf8Charset = "; charset=utf-8";

    /// <summary>
    /// Every format a file uploaded into the editor may have.
    /// </summary>
    private static readonly ImmutableArray<UploadFormat> _formats =
    [
        new(MediaTypeNames.Image.Png, FileKind.Image, "png", MediaTypeNames.Image.Png),
        new(MediaTypeNames.Image.Jpeg, FileKind.Image, "jpg", MediaTypeNames.Image.Jpeg),
        new(MediaTypeNames.Image.Webp, FileKind.Image, "webp", MediaTypeNames.Image.Webp),
        new(MediaTypeNames.Image.Gif, FileKind.Image, "gif", MediaTypeNames.Image.Gif),
        new(MediaTypeNames.Application.Pdf, FileKind.Pdf, "pdf", MediaTypeNames.Application.Pdf),
        new(MediaTypeNames.Text.Plain, FileKind.Text, "txt", MediaTypeNames.Text.Plain + Utf8Charset),
        new(MediaTypeNames.Text.Markdown, FileKind.Text, "md", MediaTypeNames.Text.Markdown + Utf8Charset),
    ];

    #region Private Types

    /// <summary>
    /// What a file's bytes are, which decides how they are checked, which folder the file goes in and how big it may
    /// be.
    /// </summary>
    private enum FileKind
    {
        /// <summary>
        /// A picture.
        /// </summary>
        Image,

        /// <summary>
        /// A PDF.
        /// </summary>
        Pdf,

        /// <summary>
        /// A text file in UTF-8.
        /// </summary>
        Text,
    }

    /// <summary>
    /// One format a file uploaded into the editor may have.
    /// </summary>
    /// <param name="MediaType">The media type an upload names the format by.</param>
    /// <param name="Kind">What a file of the format is.</param>
    /// <param name="Extension">The extension a file of the format is named with.</param>
    /// <param name="ServedType">The media type a file of the format is stored and served with.</param>
    private sealed record UploadFormat(string MediaType, FileKind Kind, string Extension, string ServedType);

    #endregion

    #region IEditorUploadService Implementation

    /// <inheritdoc/>
    public async Task<EditorUploadDto> UploadAsync(
        string uploaderId, string mediaType, Stream content, CancellationToken cancellationToken = default)
    {
        // The format the upload names, refusing a media type no file may have
        var named = FormatNamed(mediaType) ?? throw new UploadTypeNotAllowedException();

        // The file's bytes, refusing a file bigger than its kind may be
        var bytes = await content.ReadAtMostAsync(MaxBytesOf(named.Kind), cancellationToken)
            ?? throw new UploadTooLargeException();

        // The format the bytes are, refusing bytes that aren't what the upload names
        var format = FormatOfBytes(named, bytes) ?? throw new UploadTypeNotAllowedException();

        // A name no other upload has, which sorts by when it was uploaded
        var name = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid()}.{format.Extension}";

        // The upload key, in the uploader's own folder for the kind
        var key = $"{FolderOf(uploaderId)}/{FolderOf(format.Kind)}/{name}";

        // Store the file under it, served as the format it is
        await objectStore.PutAsync(ObjectKeyOf(key), bytes, format.ServedType, cancellationToken);

        // The key the text names the file by
        return new EditorUploadDto(key);
    }

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

    #region IEditorUploadLinks Implementation

    /// <inheritdoc/>
    public ImmutableDictionary<string, string> LinksIn(string text) =>
        // Every upload key named after media:, once each, with its file's link
        UploadKeyInText().Matches(text)
            .Select(match => match.Groups["key"].Value)
            .Distinct()
            .ToImmutableDictionary(key => key, key => fileLinks.LinkFor(ObjectKeyOf(key)));

    #endregion

    #region Private Helpers

    /// <summary>
    /// The format an upload may name by a media type.
    /// </summary>
    /// <param name="mediaType">The media type, in any case, or null for none.</param>
    /// <returns>The format, or null when no file may have the media type.</returns>
    private static UploadFormat? FormatNamed(string? mediaType) =>
        // The format of that media type, which compares in any case
        _formats.FirstOrDefault(format =>
            string.Equals(format.MediaType, mediaType, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// The format a file's bytes are, given the one its upload names.
    /// </summary>
    /// <param name="named">The format the upload names.</param>
    /// <param name="bytes">The file's bytes.</param>
    /// <returns>The format, or null when the bytes aren't of the named kind.</returns>
    private static UploadFormat? FormatOfBytes(UploadFormat named, byte[] bytes) => named.Kind switch
    {
        // A picture is whatever format its header names, if a picture may have that format
        FileKind.Image => FormatNamed(RasterImages.MediaTypeOf(bytes)),

        // A PDF opens with the header every PDF opens with
        FileKind.Pdf => bytes.AsSpan().StartsWith("%PDF-"u8) ? named : null,

        // A text is the kind of text its upload names, provided it reads as UTF-8
        FileKind.Text => Utf8.IsValid(bytes) ? named : null,

        _ => throw new ArgumentOutOfRangeException(nameof(named), named.Kind, "Unknown kind of file"),
    };

    /// <summary>
    /// The most bytes a file of a kind may have.
    /// </summary>
    /// <param name="kind">The kind of file.</param>
    /// <returns>The most bytes.</returns>
    private long MaxBytesOf(FileKind kind) => kind switch
    {
        FileKind.Image => editorUploadSettings.Value.MaxImageBytes,
        FileKind.Pdf or FileKind.Text => editorUploadSettings.Value.MaxAttachmentBytes,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown kind of file"),
    };

    /// <summary>
    /// The folder files of a kind go in, inside their uploader's.
    /// </summary>
    /// <param name="kind">The kind of file.</param>
    /// <returns>The folder, the second part of the files' upload keys.</returns>
    private static string FolderOf(FileKind kind) => kind switch
    {
        FileKind.Image => "images",
        FileKind.Pdf or FileKind.Text => "attachments",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown kind of file"),
    };

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
