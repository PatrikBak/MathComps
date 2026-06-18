using MathComps.Infrastructure.BulkImport;

namespace MathComps.Infrastructure.Tests.BulkImport;

/// <summary>
/// Unit tests for <see cref="MarkdownImageRewriter.Rewrite"/>. These pin the substitution apply relies on: every
/// known ref is swapped for its dimensioned <c>media:</c> ref, the derived dimensions are stamped onto a single
/// clean query, an author-written <c>?inline=</c> survives while other params are dropped, a prefix-sharing
/// filename isn't clobbered, and a body referencing none of the images is left untouched.
/// </summary>
public class MarkdownImageRewriterTests
{
    /// <summary>
    /// A bare ref is swapped for its media key with the derived dimensions stamped on.
    /// </summary>
    [Fact]
    public void Rewrites_a_bare_ref_with_derived_dimensions()
    {
        // One body referencing one image, with its resolved key and intrinsic size.
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/incircle.svg"] = new("media:slug-incircle", 10, 10)
        };

        // Rewrite the body.
        var rewritten = MarkdownImageRewriter.Rewrite("see ![fig](images/incircle.svg) here", replacements);

        // The bare ref becomes the media key carrying its derived width/height.
        Assert.Equal("see ![fig](media:slug-incircle?width=10&height=10) here", rewritten);
    }

    /// <summary>
    /// An author-written <c>?inline=true</c> survives, leading the derived dimensions in one clean query.
    /// </summary>
    [Fact]
    public void Keeps_an_author_inline_param()
    {
        // A ref the author marked inline.
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/eq.svg"] = new("media:slug-eq", 24, 16)
        };

        // Rewrite the inline ref.
        var rewritten = MarkdownImageRewriter.Rewrite("x ![eq](images/eq.svg?inline=true) y", replacements);

        // inline leads, the derived dimensions follow, all in a single query string.
        Assert.Equal("x ![eq](media:slug-eq?inline=true&width=24&height=16) y", rewritten);
    }

    /// <summary>
    /// Author-written <c>width</c>/<c>height</c> are dropped — the derived dimensions win, in a single clean query.
    /// </summary>
    [Fact]
    public void Drops_author_width_and_height_in_favour_of_derived()
    {
        // A ref the author tried to size themselves.
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/fig.svg"] = new("media:slug-fig", 480, 210)
        };

        // Rewrite the hand-sized ref.
        var rewritten = MarkdownImageRewriter.Rewrite(
            "![fig](images/fig.svg?width=148&height=73)", replacements);

        // The author's dimensions are gone; only the derived pair remains, with no double-?.
        Assert.Equal("![fig](media:slug-fig?width=480&height=210)", rewritten);
    }

    /// <summary>
    /// An author-written <c>?scale=</c> is dropped — scale isn't carried on a problem image ref.
    /// </summary>
    [Fact]
    public void Drops_an_author_scale_param()
    {
        // A ref the author tried to scale.
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/fig.svg"] = new("media:slug-fig", 480, 210)
        };

        // Rewrite the scaled ref.
        var rewritten = MarkdownImageRewriter.Rewrite("![fig](images/fig.svg?scale=50)", replacements);

        // Scale is gone; only the derived dimensions remain.
        Assert.Equal("![fig](media:slug-fig?width=480&height=210)", rewritten);
    }

    /// <summary>
    /// A filename that's a prefix of another isn't clobbered — even when each carries its own query.
    /// </summary>
    [Fact]
    public void Does_not_clobber_a_prefix_sharing_filename()
    {
        // Two images whose stems share a prefix ("a" vs "ab").
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/a.svg"] = new("media:slug-a", 1, 1),
            ["images/ab.svg"] = new("media:slug-ab", 2, 2)
        };

        // A body referencing both, the shorter one carrying an inline param.
        var rewritten = MarkdownImageRewriter.Rewrite(
            "![one](images/a.svg?inline=true) ![two](images/ab.svg)", replacements);

        // Each maps to its own media key, neither bleeding into the other.
        Assert.Equal(
            "![one](media:slug-a?inline=true&width=1&height=1) ![two](media:slug-ab?width=2&height=2)", rewritten);
    }

    /// <summary>
    /// A body that references none of the supplied images comes back unchanged.
    /// </summary>
    [Fact]
    public void Leaves_a_body_without_refs_untouched()
    {
        // A replacement is offered, but the body never uses it.
        var replacements = new Dictionary<string, ResolvedImageRef>
        {
            ["images/incircle.svg"] = new("media:slug-incircle", 10, 10)
        };

        // Rewrite a ref-free body.
        var rewritten = MarkdownImageRewriter.Rewrite("no images here, just $x$ math", replacements);

        // Nothing changes.
        Assert.Equal("no images here, just $x$ math", rewritten);
    }

    /// <summary>
    /// An empty replacement map — the common image-less problem — leaves the body untouched, even when it mentions
    /// an <c>images/</c> path. (An empty key set must never become a pattern that matches everywhere.)
    /// </summary>
    [Fact]
    public void Leaves_a_body_untouched_when_there_are_no_replacements()
    {
        // Rewrite a body that mentions an images/ path against an empty map (the common image-less problem).
        var rewritten = MarkdownImageRewriter.Rewrite(
            "a body ![fig](images/fig.svg) with a ref", new Dictionary<string, ResolvedImageRef>());

        // The body comes back verbatim — nothing is rewritten and nothing throws.
        Assert.Equal("a body ![fig](images/fig.svg) with a ref", rewritten);
    }
}
