using System.ComponentModel.DataAnnotations;

namespace MathComps.Infrastructure.Options;

/// <summary>
/// Settings for the files people upload into the text editor. The annotations make a missing <c>EditorUploads</c>
/// section fail validation.
/// </summary>
public class EditorUploadSettings
{
    /// <summary>
    /// Configuration section name for these settings.
    /// </summary>
    public const string SectionName = "EditorUploads";

    /// <summary>
    /// The most of their own files an uploader gets links to in one request.
    /// </summary>
    [Range(1, int.MaxValue)]
    public required int MaxOwnLinksPerRequest { get; set; }
}
