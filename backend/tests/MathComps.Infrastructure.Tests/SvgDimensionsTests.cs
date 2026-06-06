using MathComps.Infrastructure.BulkImport;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Unit tests for <see cref="SvgDimensions.Parse"/> — the pure half of the SVG width/height reader. They pin its
/// contract: values resolve to whole pixels (px and unit-less), points convert at 96/72, single-quoted attributes
/// are accepted, and a sizeless SVG or an unresolvable unit is a hard error rather than a silent default.
/// </summary>
public class SvgDimensionsTests
{
    /// <summary>
    /// A px-dimensioned root element yields its width and height as the integer pixel counts.
    /// </summary>
    [Fact]
    public void Parses_pixel_dimensions()
    {
        // An SVG declaring px dimensions.
        var (width, height) = SvgDimensions.Parse("<svg width=\"100px\" height=\"80px\"></svg>");

        // The "px" suffix is stripped to bare pixels.
        Assert.Equal(100, width);
        Assert.Equal(80, height);
    }

    /// <summary>
    /// A bare numeric value (no unit) is already pixels.
    /// </summary>
    [Fact]
    public void Treats_a_unitless_value_as_pixels()
    {
        // An SVG declaring unit-less dimensions.
        var (width, height) = SvgDimensions.Parse("<svg width=\"100\" height=\"80\"></svg>");

        // Carried through as pixels unchanged.
        Assert.Equal(100, width);
        Assert.Equal(80, height);
    }

    /// <summary>
    /// Point dimensions convert to pixels at 96/72, rounded to whole pixels.
    /// </summary>
    [Fact]
    public void Converts_points_to_pixels()
    {
        // 72pt is exactly 96px; 10pt rounds from 13.33.
        var (width, height) = SvgDimensions.Parse("<svg width=\"72pt\" height=\"10pt\"></svg>");

        // The point→pixel conversion, rounded.
        Assert.Equal(96, width);
        Assert.Equal(13, height);
    }

    /// <summary>
    /// Single-quoted attributes — legal SVG — are normalized and parsed.
    /// </summary>
    [Fact]
    public void Accepts_single_quoted_attributes()
    {
        // The same element with single quotes.
        var (width, height) = SvgDimensions.Parse("<svg width='42px' height='24px'></svg>");

        // Normalized and read as pixels.
        Assert.Equal(42, width);
        Assert.Equal(24, height);
    }

    /// <summary>
    /// A unit we can't resolve to a fixed pixel size (e.g. cm) is an authoring error rather than a silent guess.
    /// </summary>
    [Fact]
    public void Throws_on_an_unsupported_unit() =>
        // Centimetres don't map to a fixed intrinsic pixel size here.
        Assert.Throws<InvalidOperationException>(() => SvgDimensions.Parse("<svg width=\"10cm\" height=\"8cm\"></svg>"));

    /// <summary>
    /// A missing dimension is an authoring error — a figure with no intrinsic size can't be sized — so it throws.
    /// </summary>
    [Fact]
    public void Throws_when_a_dimension_is_missing() =>
        // An SVG with a width but no height.
        Assert.Throws<InvalidOperationException>(() => SvgDimensions.Parse("<svg width=\"100px\"></svg>"));
}
