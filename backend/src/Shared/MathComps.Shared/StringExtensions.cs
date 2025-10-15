using System.Globalization;
using System.Text;
using Slugify;

namespace MathComps.Shared;
/// <summary>
/// Provides extension methods for <see cref="string"/>.
/// </summary>
public static class StringExtensions
{
    /// <summary>
    /// Safely extracts a substring from a given starting point, without throwing an exception.
    /// It gracefully handles null strings, invalid start indices, and lengths that would
    /// extend beyond the end of the string.
    /// </summary>
    /// <param name="sourceText">The string to extract a preview from.</param>
    /// <param name="startIndex">The zero-based starting character position for the preview.</param>
    /// <param name="maxLength">The desired maximum length of the preview.</param>
    /// <returns>The preview substring. Returns an empty string if the source string is null,
    /// the startIndex is out of bounds.
    /// </returns>
    public static string PreviewAt(this string sourceText, int startIndex, int maxLength = 20)
    {
        // Nothing to preview from
        if (string.IsNullOrEmpty(sourceText) || startIndex >= sourceText.Length)
            return string.Empty;

        // Max length must be positive
        if (maxLength <= 0)
            throw new ArgumentOutOfRangeException(nameof(maxLength), "Max length must be greater than zero.");

        // Start index must be non-negative
        if (startIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(startIndex), "Start index cannot be negative.");

        // Calculate the number of characters remaining in the string from the startIndex.
        var remainingLength = sourceText.Length - startIndex;

        // Determine the actual length of the preview. It's the smaller of two values:
        // the desired maxLength or the actual number of characters remaining.
        // This is the key step that prevents an ArgumentOutOfRangeException.
        var actualLength = Math.Min(maxLength, remainingLength);

        // Now that we have a guaranteed safe startIndex and actualLength,
        // we can confidently call Substring.
        return sourceText.Substring(startIndex, actualLength);
    }

    /// <summary>
    /// Converts a string to a URL-friendly slug.
    /// </summary>
    /// <param name="value">The string to convert.</param>
    /// <returns>A URL-friendly slug.</returns>
    public static string ToSlug(this string value) => new SlugHelper().GenerateSlug(value);

    /// <summary>
    /// Removes accents and diacritics from text.
    /// </summary>
    /// <param name="text">The text to normalize by removing accents.</param>
    /// <returns>Text with all diacritics removed (café → cafe, pôžitok → pozitok).</returns>
    public static string RemoveAccents(this string text)
    {
        // Normalize the text into so called canonical decomposition.
        var normalizedText = text.Normalize(NormalizationForm.FormD);

        // In canonical decomposition, so called non-spacing marks indicate modifications of a base character (i.e. diacritics).
        normalizedText = string.Concat(normalizedText.Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark));

        // Normalize these characters into default form.
        return normalizedText.Normalize(NormalizationForm.FormC);
    }
}
