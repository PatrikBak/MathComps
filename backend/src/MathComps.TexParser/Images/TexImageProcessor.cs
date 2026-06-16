using MathComps.TexParser.Types;
using System.Text.RegularExpressions;
using TexImage = MathComps.TexParser.Types.Image;
using TexText = MathComps.TexParser.Types.Text;

namespace MathComps.TexParser.Images;

/// <summary>
/// Provides discovery, normalization, and persistence for images referenced inside parsed TeX content.
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
    /// <param name="state">Shared state for processing multiple texts with consistent numbering.</param>
    /// <returns>Processed text and an immutable list of discovered images.</returns>
    public static ImageProcessingResult Process(TexText text, ImageProcessingConfig config, ImageProcessingState state)
    {
        // Use ContentTree.Traverse to walk and transform the tree.
        var (updatedContent, finalState) = ContentTree.Traverse(
            text.Content,
            state,
            (node, nodeState) => ProcessNode(node, nodeState, config)
        );

        // Reconstruct the text with transformed blocks.
        var updatedText = text with { Content = updatedContent };

        // We're done
        return new ImageProcessingResult(updatedText, finalState.DiscoveredImages, finalState);
    }

    #endregion

    #region Private methods

    /// <summary>
    /// Processes a single content block node. Images are resolved, copied into the public folder,
    /// and rewritten to a stable content id. Other nodes pass through unchanged.
    /// </summary>
    /// <param name="node">The node to process.</param>
    /// <param name="state">Current processing state.</param>
    /// <param name="config">Configuration for image processing.</param>
    /// <returns>A <see cref="NodeTransformResult{TState}"/> with the processed node and updated state.</returns>
    private static NodeTransformResult<ImageProcessingState> ProcessNode(
        ContentBlock node,
        ImageProcessingState state,
        ImageProcessingConfig config
    )
    {
        // Only images need special handling; other nodes are returned unchanged.
        if (node is not TexImage image)
            return new(node, state);

        // Resolve the image source path using the provided resolver.
        var sourcePath = config.ImageSourceResolver(image.Id);

        // If the source is missing...
        if (sourcePath == null)
        {
            // Notify via the configured handler
            config.OnMissingImage?.Invoke(image.Id);

            // No image changes, state unchanged
            return new(image, state);
        }

        // Check if we've already processed this source image (deduplication)
        if (state.ProcessedImages.TryGetValue(image.Id, out var existingContentId))
        {
            // Reuse existing output file - no need to add metadata again
            return new(image with { Id = existingContentId }, state);
        }

        // Build a file name for using the caller's strategy.
        var newFileName = config.OutputFileName(image.Id, state.Counter);

        // Persist the image using the configured strategy (local copy, R2 upload, etc.)
        config.PersistImage(sourcePath, newFileName);

        // Use the new file name as the content id to link content JSON with metadata.
        var contentId = newFileName;

        // Read intrinsic dimensions from the SVG to support better layout in the UI.
        var (width, height) = GetSvgDimensions(sourcePath);

        // Create the new image data
        var imageData = new ImageData(
            contentId,
            image.Id,
            width,
            height,
            image.Scale
        );

        // Return updated node and state with incremented counter and added metadata.
        return new(image with { Id = contentId }, new ImageProcessingState(
            state.Counter + 1,
            state.ProcessedImages.Add(image.Id, contentId),
            state.DiscoveredImages.Add(imageData)
        ));
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
