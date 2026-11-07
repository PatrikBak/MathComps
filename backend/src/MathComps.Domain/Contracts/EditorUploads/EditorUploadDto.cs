namespace MathComps.Domain.Contracts.EditorUploads;

/// <summary>
/// A file uploaded into the text editor, as the text then refers to it.
/// </summary>
/// <param name="Key">The file's upload key, which a text names it by after <c>media:</c>.</param>
public record EditorUploadDto(string Key);
