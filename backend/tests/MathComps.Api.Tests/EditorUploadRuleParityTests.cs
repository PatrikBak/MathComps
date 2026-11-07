using System.Text.RegularExpressions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services.EditorUploads;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Cli;
using Microsoft.Extensions.Configuration;
using Moq;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the frontend holds the backend's rules for files uploaded into the editor: each kind of file's size cap
/// is the API's, and every media type the frontend lets a picture or an attachment have is one the API takes as the
/// same kind.
/// </summary>
/// <remarks>
/// The editor checks a file before it sends it, so the reader hears at once what is wrong with it. Drift is the failure
/// that matters: a file the editor lets through and the API then refuses reads as a fault, and a cap the editor holds
/// below the API's refuses files the API would take. The caps compared are the committed settings, which a
/// deployment's overlay can still change.
/// </remarks>
public class EditorUploadRuleParityTests
{
    /// <summary>
    /// The web's module holding the upload rules.
    /// </summary>
    private static string UploadConstantsPath =>
        RepoPaths.Resolve("web", "src", "constants", "file-upload-constants.ts");

    /// <summary>
    /// The API's committed settings.
    /// </summary>
    private static string ApiSettingsPath => RepoPaths.Resolve("backend", "src", "MathComps.Api", "appsettings.json");

    /// <summary>
    /// Every media type the web lets a picture have.
    /// </summary>
    public static TheoryData<string> WebPictureTypes => MediaTypesIn("ALLOWED_IMAGE_TYPES");

    /// <summary>
    /// Every media type the web lets an attachment have.
    /// </summary>
    public static TheoryData<string> WebAttachmentTypes => MediaTypesIn("ALLOWED_ATTACHMENT_TYPES");

    /// <summary>
    /// Both ends cap a picture and an attachment at the same size.
    /// </summary>
    [Fact]
    public void Ts_size_caps_match_the_backend()
    {
        // The API's committed upload settings
        var settings = new ConfigurationBuilder()
            .AddJsonFile(ApiSettingsPath)
            .Build()
            .GetSection(EditorUploadSettings.SectionName)
            .Get<EditorUploadSettings>()!;

        // A picture's cap, which the web writes in megabytes
        Assert.Equal(
            settings.MaxImageBytes,
            long.Parse(WebSource.ReadConstant(UploadConstantsPath, "MAX_IMAGE_SIZE_MB")) * 1024 * 1024);

        // An attachment's cap, also in megabytes on the web
        Assert.Equal(
            settings.MaxAttachmentBytes,
            long.Parse(WebSource.ReadConstant(UploadConstantsPath, "MAX_ATTACHMENT_SIZE_MB")) * 1024 * 1024);
    }

    /// <summary>
    /// The API takes each media type the web lets a picture have, as a picture's. The upload is one byte over a
    /// picture's cap and far under an attachment's, so only a type taken as a picture's is refused as too big.
    /// </summary>
    /// <param name="mediaType">The media type.</param>
    [Theory]
    [MemberData(nameof(WebPictureTypes))]
    public async Task A_picture_type_the_web_takes_is_a_picture_to_the_backend(string mediaType) =>
        // Refused for its size, which the API weighs only once it knows the type
        await Assert.ThrowsAsync<UploadTooLargeException>(() =>
            UploadTwoBytesAsync(mediaType, maxImageBytes: 1, maxAttachmentBytes: 1000));

    /// <summary>
    /// The API takes each media type the web lets an attachment have, as an attachment's. The upload is one byte over
    /// an attachment's cap and far under a picture's, so only a type taken as an attachment's is refused as too big.
    /// </summary>
    /// <param name="mediaType">The media type.</param>
    [Theory]
    [MemberData(nameof(WebAttachmentTypes))]
    public async Task An_attachment_type_the_web_takes_is_an_attachment_to_the_backend(string mediaType) =>
        // Refused for its size, which the API weighs only once it knows the type
        await Assert.ThrowsAsync<UploadTooLargeException>(() =>
            UploadTwoBytesAsync(mediaType, maxImageBytes: 1000, maxAttachmentBytes: 1));

    /// <summary>
    /// Reads the media types one of the web's lists names.
    /// </summary>
    /// <param name="name">The list's name.</param>
    /// <returns>A row per media type, in the list's order.</returns>
    private static TheoryData<string> MediaTypesIn(string name)
    {
        // The rows, filled below
        var mediaTypes = new TheoryData<string>();

        // Each single-quoted member of the list
        foreach (var mediaType in Regex.Matches(WebSource.ReadConstant(UploadConstantsPath, name), "'([^']+)'")
                     .Select(match => match.Groups[1].Value))
            mediaTypes.Add(mediaType);

        // A row per media type
        return mediaTypes;
    }

    /// <summary>
    /// Uploads a two-byte file under a media type, to a service taking files up to the given sizes.
    /// </summary>
    /// <param name="mediaType">The media type the upload names.</param>
    /// <param name="maxImageBytes">The biggest picture the service takes, in bytes.</param>
    /// <param name="maxAttachmentBytes">The biggest attachment the service takes, in bytes.</param>
    /// <returns>A task that completes once the service has answered.</returns>
    private static async Task UploadTwoBytesAsync(string mediaType, long maxImageBytes, long maxAttachmentBytes)
    {
        // The service, over a store and links that stand in for the private bucket
        var service = new EditorUploadService(
            Mock.Of<IPrivateObjectStore>(),
            Mock.Of<IPrivateFileLinks>(),
            MsOptions.Create(new EditorUploadSettings
            {
                MaxOwnLinksPerRequest = 1,
                MaxImageBytes = maxImageBytes,
                MaxAttachmentBytes = maxAttachmentBytes,
            }));

        // The file's two bytes
        using var content = new MemoryStream(new byte[2]);

        // The upload
        await service.UploadAsync("user_abc", mediaType, content);
    }
}
