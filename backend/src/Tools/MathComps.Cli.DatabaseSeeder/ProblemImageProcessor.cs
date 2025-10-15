using MathComps.Shared;
using MathComps.TexParser.Types;
using Spectre.Console;
using System.Collections.Immutable;
using System.Text.RegularExpressions;
using TexImage = MathComps.TexParser.Types.Image;
using TexParagraph = MathComps.TexParser.Types.Paragraph;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.Cli.DatabaseSeeder;

/// <summary>
/// Provides discovery, normalization, and persistence for images referenced inside parsed TeX content.
/// Walks a <see cref="TexText"/> tree, copies image assets into the API's public folder,
/// and rewrites image identifiers to stable, URL-friendly content ids that tie to DB metadata.
/// </summary>
public static class ProblemImageProcessor
{
    #region Private records

    /// <summary>
    /// Problem data relevant to image processing.
    /// </summary>
    /// <param name="Slug">The unique human-readable ID used in the DB for the problem.</param>
    /// <param name="OlympiadYear">The olympiad year of the problem (e.g. 75)</param>
    public record ProblemMetadata(string Slug, int OlympiadYear);

    #endregion

    #region Private Constants

    /// <summary>
    /// Relative path to the API's public problem images directory.
    /// </summary>
    private const string PublicImagesRelativePath = "../../Api/MathComps.Api/wwwroot/images/problems";

    #endregion

    #region Public API

    /// <summary>
    /// Traverses the content of a <see cref="Text"/> object, processing any images found.
    /// Returns a new <see cref="Text"/> instance with updated image references and a list of discovered image metadata.
    /// </summary>
    /// <param name="text">Parsed TeX content tree to scan. May be <see langword="null"/>.</param>
    /// <param name="metadata">Problem metadata used for deterministic file names and path lookups.</param>
    /// <returns>Processed text (or <see langword="null"/>) and an immutable list of discovered images.</returns>
    public static ProblemImageProcessingResult Process(TexText? text, ProblemMetadata metadata)
    {
        // If there is no text, nothing needs to be processed; return an empty image set and null text.
        if (text is null)
            return new ProblemImageProcessingResult(null, []);

        // Initialize a deterministic suffix counter so generated file names are stable across runs.
        var imageCounter = 1;

        // Prepare a collector for discovered image metadata.
        var discoveredImages = ImmutableList.CreateBuilder<ProblemImageData>();

        // Walk and transform the content tree, rewriting images and collecting metadata as we go.
        var updatedContent = ProcessBlocks(text.Content, metadata, ref imageCounter, discoveredImages);

        // Reconstruct the text with transformed blocks.
        var updatedText = text with { Content = updatedContent };

        // We're done
        return new ProblemImageProcessingResult(updatedText, discoveredImages.ToImmutable());
    }

    #endregion

    #region Private methods

    /// <summary>
    /// Recursively processes a list of content blocks, transforming images and rewriting container children.
    /// </summary>
    /// <param name="blocks">Blocks to transform.</param>
    /// <param name="problemData">Problem metadata for naming and lookups.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of blocks.</returns>
    private static ImmutableList<ContentBlock> ProcessBlocks(
        ImmutableList<ContentBlock> blocks,
        ProblemMetadata problemData,
        ref int imageCounter,
        ImmutableList<ProblemImageData>.Builder discoveredImages
    )
    {
        // Accumulate transformed blocks in order to preserve layout and sequencing.
        var builder = ImmutableList.CreateBuilder<ContentBlock>();

        // Handle each block
        foreach (var block in blocks)
            builder.Add(ProcessBlock(block, problemData, ref imageCounter, discoveredImages));

        // Freeze results into an immutable list to match the domain model's preference for immutability.
        return builder.ToImmutable();
    }

    /// <summary>
    /// Transforms a single content block. Container nodes are rewritten by transforming their children;
    /// image nodes are resolved, copied into the public folder, and rewritten to a stable content id.
    /// </summary>
    /// <param name="block">Block to transform.</param>
    /// <param name="problemData">Problem metadata for naming and lookups.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>The transformed block.</returns>
    private static ContentBlock ProcessBlock(
        ContentBlock block,
        ProblemMetadata problemData,
        ref int imageCounter,
        ImmutableList<ProblemImageData>.Builder discoveredImages
    )
    => block switch
    {
        // The actual image
        TexImage image => ProcessImage(image, problemData, ref imageCounter, discoveredImages),

        // Current parsing
        TexParagraph paragraph => paragraph with { Content = ProcessRawBlocks(paragraph.Content, problemData, ref imageCounter, discoveredImages) },
        ItemList list => list with { Items = ProcessListOfLists(list.Items, problemData, ref imageCounter, discoveredImages) },
        BoldText bold => bold with { Content = ProcessRawBlocks(bold.Content, problemData, ref imageCounter, discoveredImages) },
        ItalicText italic => italic with { Content = ProcessRawBlocks(italic.Content, problemData, ref imageCounter, discoveredImages) },
        QuoteText quote => quote with { Content = ProcessRawBlocks(quote.Content, problemData, ref imageCounter, discoveredImages) },
        Footnote footnote => footnote with { Content = ProcessRawBlocks(footnote.Content, problemData, ref imageCounter, discoveredImages) },

        // Blocks without images
        MathTex or PlainText => block,

        // Other cases intentionally not handled, shouldn't appear in problems
        _ => throw new Exception($"Unhandled type of {nameof(ContentBlock)}: {block.GetType()}"),
    };

    /// <summary>
    /// Processes a list of list-items (each item is a list of raw blocks), transforming each item independently.
    /// </summary>
    /// <param name="listOfLists">List-items to transform.</param>
    /// <param name="problemData">Problem metadata for naming and lookups.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of list-items.</returns>
    private static ImmutableList<ImmutableList<RawContentBlock>> ProcessListOfLists(
        ImmutableList<ImmutableList<RawContentBlock>> listOfLists,
        ProblemMetadata problemData,
        ref int imageCounter,
        ImmutableList<ProblemImageData>.Builder discoveredImages
    )
    {
        // Build each new list item
        var outerBuilder = ImmutableList.CreateBuilder<ImmutableList<RawContentBlock>>();

        // Handle each list item
        foreach (var listItemBlocks in listOfLists)
            outerBuilder.Add(ProcessRawBlocks(listItemBlocks, problemData, ref imageCounter, discoveredImages));

        // We're happy
        return outerBuilder.ToImmutable();
    }

    /// <summary>
    /// Transforms a list of raw content blocks by delegating to the general content block transformer.
    /// </summary>
    /// <param name="blocks">Raw blocks to transform.</param>
    /// <param name="problemData">Problem metadata for naming and lookups.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of raw blocks.</returns>
    private static ImmutableList<RawContentBlock> ProcessRawBlocks(
        ImmutableList<RawContentBlock> blocks,
        ProblemMetadata problemData,
        ref int imageCounter,
        ImmutableList<ProblemImageData>.Builder discoveredImages
    )
    {
        // Build new list of blocks
        var builder = ImmutableList.CreateBuilder<RawContentBlock>();

        // Handle each block
        foreach (var block in blocks)
            builder.Add((RawContentBlock)ProcessBlock(block, problemData, ref imageCounter, discoveredImages));

        // We're happy
        return builder.ToImmutable();
    }

    /// <summary>
    /// Resolves, copies, and rewrites a single image node, recording discovered metadata for persistence.
    /// </summary>
    /// <param name="image">Image node to process.</param>
    /// <param name="problemData">Problem metadata for naming and lookups.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Updated image node with a stable content id.</returns>
    private static TexImage ProcessImage(
        TexImage image,
        ProblemMetadata problemData,
        ref int imageCounter,
        ImmutableList<ProblemImageData>.Builder discoveredImages)
    {
        // Resolve the image source path based on the TeX id and problem context.
        var sourcePath = SkmoImageHelper.FindImageSourcePath(image.Id, problemData.OlympiadYear);

        // If the source is missing...
        if (sourcePath == null)
        {
            // Make aware
            AnsiConsole.MarkupLine($"[yellow]Warning:[/] Problem [yellow]{problemData.Slug}[/] has a missing image: {image.Id}");

            // No image changes
            return image;
        }

        // Build a deterministic file name for stable URLs.
        var newFileName = $"{problemData.Slug}-{imageCounter}.svg";

        // Find its path in the public image dir
        var newFilePath = Path.Combine(PublicImagesRelativePath, newFileName);

        // Copy the discovered source file into the public directory (overwrite to keep idempotence).
        File.Copy(sourcePath, newFilePath, overwrite: true);

        // Use the new file name as the content id to link content JSON with DB metadata rows.
        var contentId = newFileName;

        // Read intrinsic dimensions from the SVG to support better layout in the UI.
        var (width, height) = GetSvgDimensions(sourcePath);

        // We have an image
        discoveredImages.Add(new ProblemImageData(
            contentId,
            width,
            height,
            image.Scale
        ));

        //Advance the counter so subsequent images receive incremented suffixes.
        imageCounter++;

        // Update the image with the new id
        return image with { Id = contentId };
    }

    /// <summary>
    /// Attempts to parse optional width and height attributes from an SVG file.
    /// </summary>
    /// <param name="svgPath">Absolute path to the SVG file.</param>
    /// <returns>Tuple of width and height, or <c>(null, null)</c> if not present or parsing failed.</returns>
    private static (string width, string height) GetSvgDimensions(string svgPath)
    {
        // Read the file
        var svgContent = File.ReadAllText(svgPath)
            // Normalize quotes
            .Replace('\'', '"');

        // The width and height should be embedded there nicely
        var widthMatch = Regex.Match(svgContent, "\\swidth=\"([^\"]+)\"");
        var heightMatch = Regex.Match(svgContent, "\\sheight=\"([^\"]+)\"");

        // We want matches
        if (!widthMatch.Success || !heightMatch.Success)
            throw new Exception($"Could not parse SVG dimensions for: {svgPath}");

        // Extract raw values including units (e.g., "100px", "10cm")
        var width = widthMatch.Groups[1].Value;
        var height = heightMatch.Groups[1].Value;

        // We're happy
        return (width, height);
    }

    #endregion
}
