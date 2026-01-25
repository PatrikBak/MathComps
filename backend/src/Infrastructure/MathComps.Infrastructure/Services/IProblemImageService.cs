namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for querying problem image data.
/// </summary>
public interface IProblemImageService
{
    /// <summary>
    /// Gets the image ID mapping for a problem (OriginalId -> ContentId).
    /// </summary>
    /// <param name="problemId">The problem ID.</param>
    /// <returns>Dictionary mapping original image IDs to processed content IDs.</returns>
    Task<Dictionary<string, string>> GetImageMappingAsync(Guid problemId);
}
