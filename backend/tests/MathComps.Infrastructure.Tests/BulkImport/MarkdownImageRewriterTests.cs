using MathComps.Infrastructure.BulkImport;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Unit tests for <see cref="MarkdownImageRewriter.Rewrite"/>. These pin the substitution behaviour apply relies
/// on: every known relative ref is swapped, a prefix-sharing filename isn't clobbered, and a body that references
/// none of the images is left untouched.
/// </summary>
public class MarkdownImageRewriterTests
{
    /// <summary>
    /// A single relative ref is replaced with its resolved media ref.
    /// </summary>
    [Fact]
    public void Rewrites_a_single_ref()
    {
        // One body referencing one image, with its resolved replacement.
        var replacements = new Dictionary<string, string>
        {
            ["images/incircle.svg"] = "media:slug-incircle?width=10px&height=10px"
        };

        // Rewrite the body.
        var rewritten = MarkdownImageRewriter.Rewrite("see ![fig](images/incircle.svg) here", replacements);

        // The ref is swapped for the media key.
        Assert.Equal("see ![fig](media:slug-incircle?width=10px&height=10px) here", rewritten);
    }

    /// <summary>
    /// A filename that's a prefix of another isn't clobbered — the full path token disambiguates the two.
    /// </summary>
    [Fact]
    public void Does_not_clobber_a_prefix_sharing_filename()
    {
        // Two images whose stems share a prefix ("a" vs "ab").
        var replacements = new Dictionary<string, string>
        {
            ["images/a.svg"] = "media:slug-a?width=1px&height=1px",
            ["images/ab.svg"] = "media:slug-ab?width=2px&height=2px"
        };

        // A body referencing both.
        var rewritten = MarkdownImageRewriter.Rewrite(
            "![one](images/a.svg) ![two](images/ab.svg)", replacements);

        // Each maps to its own media key, neither bleeding into the other.
        Assert.Equal(
            "![one](media:slug-a?width=1px&height=1px) ![two](media:slug-ab?width=2px&height=2px)", rewritten);
    }

    /// <summary>
    /// A body that references none of the supplied images comes back unchanged.
    /// </summary>
    [Fact]
    public void Leaves_a_body_without_refs_untouched()
    {
        // A replacement is offered, but the body never uses it.
        var replacements = new Dictionary<string, string>
        {
            ["images/incircle.svg"] = "media:slug-incircle?width=10px&height=10px"
        };

        // Rewrite a ref-free body.
        var rewritten = MarkdownImageRewriter.Rewrite("no images here, just $x$ math", replacements);

        // Nothing changes.
        Assert.Equal("no images here, just $x$ math", rewritten);
    }
}
