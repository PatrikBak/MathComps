using MathComps.TexParser.Types;
using System.Collections.Immutable;
using System.Text.RegularExpressions;
using TexImage = MathComps.TexParser.Types.Image;
using TexParagraph = MathComps.TexParser.Types.Paragraph;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.TexParser.Images;

/// <summary>
/// Provides discovery, normalization, and persistence for images referenced inside parsed TeX content.
/// Walks a <see cref="TexText"/> tree, copies image assets into a specified output folder,
/// and rewrites image identifiers to reasonably-named URL-friendly ids.
/// </summary>
public static class TexImageProcessor
{
    #region Public API

    /// <summary>
    /// Traverses the content of a <see cref="TexText"/> object, processing any images found.
    /// Returns a new <see cref="TexText"/> instance with updated image references and a list of discovered image metadata.
    /// </summary>
    /// <param name="text">Parsed TeX content tree to scan.</param>
    /// <param name="config">Configuration for image processing including naming and output paths.</param>
    /// <returns>Processed text and an immutable list of discovered images.</returns>
    public static ImageProcessingResult Process(TexText text, ImageProcessingConfig config)
    {
        // Initialize a deterministic suffix counter so generated file names are stable across runs.
        var imageCounter = 1;

        // Prepare a collector for discovered image metadata.
        var discoveredImages = ImmutableList.CreateBuilder<ImageData>();

        // Walk and transform the content tree, rewriting images and collecting metadata as we go.
        var updatedContent = ProcessBlocks(text.Content, config, ref imageCounter, discoveredImages);

        // Reconstruct the text with transformed blocks.
        var updatedText = text with { Content = updatedContent };

        // We're done
        return new ImageProcessingResult(updatedText, discoveredImages.ToImmutable());
    }

    #endregion

    #region Private methods

    /// <summary>
    /// Recursively processes a list of content blocks, transforming images and rewriting container children.
    /// </summary>
    /// <param name="blocks">Blocks to transform.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of blocks.</returns>
    private static ImmutableList<ContentBlock> ProcessBlocks(
        ImmutableList<ContentBlock> blocks,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages
    )
    {
        // Accumulate transformed blocks in order to preserve layout and sequencing.
        var builder = ImmutableList.CreateBuilder<ContentBlock>();

        // Handle each block
        foreach (var block in blocks)
            builder.Add(ProcessBlock(block, config, ref imageCounter, discoveredImages));

        // Freeze results into an immutable list to match the domain model's preference for immutability.
        return builder.ToImmutable();
    }

    /// <summary>
    /// Transforms a single content block. Container nodes are rewritten by transforming their children;
    /// image nodes are resolved, copied into the public folder, and rewritten to a stable content id.
    /// </summary>
    /// <param name="block">Block to transform.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>The transformed block.</returns>
    private static ContentBlock ProcessBlock(
        ContentBlock block,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages
    )
    => block switch
    {
        // The actual image
        TexImage image => ProcessImage(image, config, ref imageCounter, discoveredImages),

        // Complex nested blocks
        TexParagraph paragraph => paragraph with { Content = ProcessRawBlocks(paragraph.Content, config, ref imageCounter, discoveredImages) },
        ItemList list => list with { Items = ProcessListOfLists(list.Items, config, ref imageCounter, discoveredImages) },
        BoldText bold => bold with { Content = ProcessRawBlocks(bold.Content, config, ref imageCounter, discoveredImages) },
        ItalicText italic => italic with { Content = ProcessRawBlocks(italic.Content, config, ref imageCounter, discoveredImages) },
        QuoteText quote => quote with { Content = ProcessRawBlocks(quote.Content, config, ref imageCounter, discoveredImages) },
        Footnote footnote => footnote with { Content = ProcessRawBlocks(footnote.Content, config, ref imageCounter, discoveredImages) },
        Link link => link with { Content = ProcessRawBlocks(link.Content, config, ref imageCounter, discoveredImages) },
        Theorem theorem => theorem with
        {
            Title = ProcessOptionalRawBlock(theorem.Title, config, ref imageCounter, discoveredImages),
            Body = ProcessRawBlocks(theorem.Body, config, ref imageCounter, discoveredImages),
            Proof = ProcessRawBlocks(theorem.Proof, config, ref imageCounter, discoveredImages)
        },
        Exercise exercise => exercise with
        {
            Title = ProcessOptionalRawBlock(exercise.Title, config, ref imageCounter, discoveredImages),
            Body = ProcessRawBlocks(exercise.Body, config, ref imageCounter, discoveredImages),
            Solution = ProcessRawBlocks(exercise.Solution, config, ref imageCounter, discoveredImages)
        },
        Problem problem => problem with
        {
            Title = ProcessOptionalRawBlock(problem.Title, config, ref imageCounter, discoveredImages),
            Body = ProcessRawBlocks(problem.Body, config, ref imageCounter, discoveredImages),
            Hints = ProcessListOfLists(problem.Hints, config, ref imageCounter, discoveredImages),
            Solution = ProcessRawBlocks(problem.Solution, config, ref imageCounter, discoveredImages)
        },
        Example example => example with
        {
            Title = ProcessOptionalRawBlock(example.Title, config, ref imageCounter, discoveredImages),
            Body = ProcessRawBlocks(example.Body, config, ref imageCounter, discoveredImages),
            Solution = ProcessRawBlocks(example.Solution, config, ref imageCounter, discoveredImages)
        },

        // Blocks without images
        MathTex or PlainText => block,

        // Other cases intentionally not handled, shouldn't appear in problems
        _ => throw new Exception($"Unhandled type of {nameof(ContentBlock)}: {block.GetType()}"),
    };

    /// <summary>
    /// Processes a list of list-items (each item is a list of raw blocks), transforming each item independently.
    /// </summary>
    /// <param name="listOfLists">List-items to transform.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of list-items.</returns>
    private static ImmutableList<ImmutableList<RawContentBlock>> ProcessListOfLists(
        ImmutableList<ImmutableList<RawContentBlock>> listOfLists,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages
    )
    {
        // Build each new list item
        var outerBuilder = ImmutableList.CreateBuilder<ImmutableList<RawContentBlock>>();

        // Handle each list item
        foreach (var listItemBlocks in listOfLists)
            outerBuilder.Add(ProcessRawBlocks(listItemBlocks, config, ref imageCounter, discoveredImages));

        // We're happy
        return outerBuilder.ToImmutable();
    }

    /// <summary>
    /// Transforms a list of raw content blocks by delegating to the general content block transformer.
    /// </summary>
    /// <param name="blocks">Raw blocks to transform.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed immutable list of raw blocks.</returns>
    private static ImmutableList<RawContentBlock> ProcessRawBlocks(
        ImmutableList<RawContentBlock> blocks,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages
    )
    {
        // Build new list of blocks
        var builder = ImmutableList.CreateBuilder<RawContentBlock>();

        // Handle each block
        foreach (var block in blocks)
            builder.Add((RawContentBlock)ProcessBlock(block, config, ref imageCounter, discoveredImages));

        // We're happy
        return builder.ToImmutable();
    }

    /// <summary>
    /// Transforms a single optional raw content block by delegating to the general content block transformer.
    /// </summary>
    /// <param name="block">Optional raw block to transform.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Transformed optional raw block.</returns>
    private static RawContentBlock? ProcessOptionalRawBlock(
        RawContentBlock? block,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages
    )
    => block is null
        ? null
        : (RawContentBlock)ProcessBlock(block, config, ref imageCounter, discoveredImages);

    /// <summary>
    /// Resolves, copies, and rewrites a single image node, recording discovered metadata for persistence.
    /// </summary>
    /// <param name="image">Image node to process.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <param name="imageCounter">Running counter used to suffix image files.</param>
    /// <param name="discoveredImages">Collector for discovered image metadata.</param>
    /// <returns>Updated image node with a stable content id.</returns>
    private static TexImage ProcessImage(
        TexImage image,
        ImageProcessingConfig config,
        ref int imageCounter,
        ImmutableList<ImageData>.Builder discoveredImages)
    {
        // Resolve the image source path using the provided resolver.
        var sourcePath = config.ImageSourceResolver(image.Id);

        // If the source is missing...
        if (sourcePath == null)
        {
            // Notify via the configured handler
            config.OnMissingImage?.Invoke(image.Id);

            // No image changes
            return image;
        }

        // Build a deterministic file name for stable URLs.
        var newFileName = $"{config.FileNamePrefix}-{imageCounter}.svg";

        // Find its path in the output directory
        var newFilePath = Path.Combine(config.OutputDirectory, newFileName);

        // Ensure the output directory exists
        Directory.CreateDirectory(config.OutputDirectory);

        // Copy the discovered source file into the output directory (overwrite to keep idempotence).
        File.Copy(sourcePath, newFilePath, overwrite: true);

        // Use the new file name as the content id to link content JSON with metadata.
        var contentId = newFileName;

        // Read intrinsic dimensions from the SVG to support better layout in the UI.
        var (width, height) = GetSvgDimensions(sourcePath);

        // We have an image
        discoveredImages.Add(new ImageData(
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
