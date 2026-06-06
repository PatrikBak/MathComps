using System.Globalization;
using System.Text.RegularExpressions;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Reads the intrinsic <c>width</c> / <c>height</c> off an SVG's root element and returns them as whole pixels —
/// the integer-pixel form the image-URL dimension params require, so a unit suffix (<c>"px"</c>, <c>"pt"</c>) is
/// resolved here rather than carried through.
/// </summary>
public static class SvgDimensions
{
    /// <summary>
    /// Splits a raw dimension value into its numeric magnitude (group 1) and an optional unit suffix (group 2).
    /// </summary>
    private static readonly Regex _valuePattern = new(@"^([0-9]*\.?[0-9]+)([a-z%]*)$", RegexOptions.IgnoreCase);

    /// <summary>CSS's reference resolution — the pixels-per-inch every absolute CSS unit is defined against.</summary>
    private const double PixelsPerInch = 96.0;

    /// <summary>The typographic definition of a point — points-per-inch.</summary>
    private const double PointsPerInch = 72.0;

    /// <summary>
    /// Reads an SVG file and parses its root <c>width</c> / <c>height</c> into whole pixels.
    /// </summary>
    /// <param name="svgPath">Absolute path to the SVG file.</param>
    /// <returns>The width and height in pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown when an attribute is absent or can't be sized.</exception>
    public static (int Width, int Height) Read(string svgPath) =>
        // Read the file, then hand the content to the pure parser.
        Parse(File.ReadAllText(svgPath), svgPath);

    /// <summary>
    /// Parses the root <c>width</c> / <c>height</c> out of SVG markup, converting each to whole pixels. Pure — the
    /// file-reading half lives in <see cref="Read"/>.
    /// </summary>
    /// <param name="svgContent">The SVG markup.</param>
    /// <param name="source">A label for the error message (e.g. the file path); purely diagnostic.</param>
    /// <returns>The width and height in pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown when an attribute is absent or can't be sized.</exception>
    public static (int Width, int Height) Parse(string svgContent, string source = "<svg>")
    {
        // Single-quoted attributes are legal SVG; normalize to double quotes so one regex covers both.
        var normalized = svgContent.Replace('\'', '"');

        // The width and height sit on the root element as plain attributes.
        var widthMatch = DimensionAttribute("width").Match(normalized);
        var heightMatch = DimensionAttribute("height").Match(normalized);

        // Both are required — a figure with no intrinsic size can't be sized, so that's an authoring error.
        if (!widthMatch.Success || !heightMatch.Success)
            throw new InvalidOperationException($"Could not parse SVG width/height for: {source}");

        // Resolve each raw value (units and all) to whole pixels.
        return (ToPixels(widthMatch.Groups[1].Value, source), ToPixels(heightMatch.Groups[1].Value, source));
    }

    /// <summary>
    /// Converts one raw SVG dimension value (e.g. <c>"100px"</c>, <c>"10pt"</c>, <c>"80"</c>) to whole pixels. A
    /// unit we can't resolve to a fixed pixel size — a relative or exotic unit — is an authoring error, not a
    /// guess, so it throws rather than silently mis-sizing the figure.
    /// </summary>
    /// <param name="raw">The raw attribute value, with an optional unit suffix.</param>
    /// <param name="source">A label for the error message; purely diagnostic.</param>
    /// <returns>The dimension rounded to whole pixels.</returns>
    /// <exception cref="InvalidOperationException">Thrown for a malformed number or an unsupported unit.</exception>
    private static int ToPixels(string raw, string source)
    {
        // Split the value into its numeric magnitude and an optional unit suffix.
        var match = _valuePattern.Match(raw.Trim());
        if (!match.Success)
            throw new InvalidOperationException($"Could not parse SVG dimension \"{raw}\" for: {source}");

        // The magnitude, parsed invariantly so a decimal point reads the same in every locale.
        var magnitude = double.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);

        // Scale to pixels by unit — a bare value is already pixels, a point is 96/72 of one. Anything else can't
        // map to a fixed intrinsic size, so it's a hard error.
        var pixels = match.Groups[2].Value.ToLowerInvariant() switch
        {
            "" or "px" => magnitude,
            "pt" => magnitude * PixelsPerInch / PointsPerInch,
            var unit => throw new InvalidOperationException($"Unsupported SVG dimension unit \"{unit}\" for: {source}"),
        };

        // Whole pixels — sub-pixel precision is meaningless for layout reservation.
        return (int)Math.Round(pixels);
    }

    /// <summary>
    /// Builds the regex matching one dimension attribute (<c>width</c> or <c>height</c>) and capturing its value.
    /// The leading whitespace requirement keeps it from matching a longer attribute that merely ends in the name.
    /// </summary>
    /// <param name="attribute">The attribute name to match.</param>
    /// <returns>The compiled regex.</returns>
    private static Regex DimensionAttribute(string attribute) =>
        new($"\\s{attribute}=\"([^\"]+)\"");
}
