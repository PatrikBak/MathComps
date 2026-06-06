using MathComps.Infrastructure.BulkImport;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Unit tests for <see cref="SvgDimensions.Parse"/> — the pure half of the SVG width/height reader. These pin the
/// behaviours the apply ref-rewrite depends on: units are kept verbatim, single-quoted attributes are accepted,
/// and a sizeless SVG is a hard error rather than a silent default.
/// </summary>
public class SvgDimensionsTests
{
    /// <summary>
    /// A px-dimensioned root element yields its width and height verbatim.
    /// </summary>
    [Fact]
    public void Parses_pixel_dimensions_verbatim()
    {
        // An SVG declaring integer-px dimensions.
        var (width, height) = SvgDimensions.Parse("<svg width=\"100px\" height=\"80px\"></svg>");

        // Both come back exactly as written.
        Assert.Equal("100px", width);
        Assert.Equal("80px", height);
    }

    /// <summary>
    /// Non-px units (e.g. cm) survive untouched — the reader doesn't convert, it just carries the raw value.
    /// </summary>
    [Fact]
    public void Keeps_non_pixel_units()
    {
        // An SVG declaring centimetre dimensions.
        var (width, height) = SvgDimensions.Parse("<svg width=\"10cm\" height=\"8cm\"></svg>");

        // The units are preserved.
        Assert.Equal("10cm", width);
        Assert.Equal("8cm", height);
    }

    /// <summary>
    /// Single-quoted attributes — legal SVG — are normalized and parsed.
    /// </summary>
    [Fact]
    public void Accepts_single_quoted_attributes()
    {
        // The same element with single quotes.
        var (width, height) = SvgDimensions.Parse("<svg width='42px' height='24px'></svg>");

        // Normalized and read.
        Assert.Equal("42px", width);
        Assert.Equal("24px", height);
    }

    /// <summary>
    /// A missing dimension is an authoring error — a figure with no intrinsic size can't be sized — so it throws.
    /// </summary>
    [Fact]
    public void Throws_when_a_dimension_is_missing() =>
        // An SVG with a width but no height.
        Assert.Throws<InvalidOperationException>(() => SvgDimensions.Parse("<svg width=\"100px\"></svg>"));
}
