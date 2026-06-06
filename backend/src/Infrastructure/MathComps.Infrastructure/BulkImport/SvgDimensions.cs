using System.Text.RegularExpressions;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// Reads the intrinsic <c>width</c> / <c>height</c> off an SVG's root element. The values are returned verbatim,
/// units included (e.g. <c>"100px"</c>, <c>"10cm"</c>) — no unit conversion.
/// </summary>
public static class SvgDimensions
{
    /// <summary>
    /// Reads an SVG file and parses its root <c>width</c> / <c>height</c>.
    /// </summary>
    /// <param name="svgPath">Absolute path to the SVG file.</param>
    /// <returns>The width and height attribute values, units included.</returns>
    /// <exception cref="InvalidOperationException">Thrown when either attribute is absent.</exception>
    public static (string Width, string Height) Read(string svgPath) =>
        // Read the file, then hand the content to the pure parser.
        Parse(File.ReadAllText(svgPath), svgPath);

    /// <summary>
    /// Parses the root <c>width</c> / <c>height</c> out of SVG markup. Pure — the file-reading half lives in
    /// <see cref="Read"/>.
    /// </summary>
    /// <param name="svgContent">The SVG markup.</param>
    /// <param name="source">A label for the error message (e.g. the file path); purely diagnostic.</param>
    /// <returns>The width and height attribute values, units included.</returns>
    /// <exception cref="InvalidOperationException">Thrown when either attribute is absent.</exception>
    public static (string Width, string Height) Parse(string svgContent, string source = "<svg>")
    {
        // Single-quoted attributes are legal SVG; normalize to double quotes so one regex covers both.
        var normalized = svgContent.Replace('\'', '"');

        // The width and height sit on the root element as plain attributes.
        var widthMatch = DimensionAttribute("width").Match(normalized);
        var heightMatch = DimensionAttribute("height").Match(normalized);

        // Both are required — a figure with no intrinsic size can't be sized, so that's an authoring error.
        if (!widthMatch.Success || !heightMatch.Success)
            throw new InvalidOperationException($"Could not parse SVG width/height for: {source}");

        // Hand back the raw values, units and all.
        return (widthMatch.Groups[1].Value, heightMatch.Groups[1].Value);
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
