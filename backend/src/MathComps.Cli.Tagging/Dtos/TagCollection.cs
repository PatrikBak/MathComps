using MathComps.Shared.Converters;
using MathComps.Shared;
using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// Represents tags organized by category, where each category contains an array of tag identifiers.
/// </summary>
/// <param name="Data">Dictionary mapping tag types to arrays of tags</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<SimpleTagsByCategory>))]
public record SimpleTagsByCategory(ImmutableDictionary<TagType, string[]> Data)
{
    /// <summary>
    /// Filters the tags based on approval decisions, returning only approved tags.
    /// </summary>
    /// <param name="approvals">Dictionary mapping tags to their approval status</param>
    /// <param name="unmatchedApprovals">Output parameter containing approval decisions for tags not found in this collection</param>
    /// <param name="unmatchedCandidates">Output parameter containing tags that were not in the approvals dictionary</param>
    /// <returns>A new collection containing only the approved tags</returns>
    public SimpleTagsByCategory Filter(
        ImmutableDictionary<string, bool> approvals,
        out HashSet<string> unmatchedApprovals,
        out HashSet<string> unmatchedCandidates)
    {
        // This will be the result later wrapped as immutable
        var filteredResult = new Dictionary<TagType, List<string>>();

        // Track unmatched approvals/candidates, we'll be removing/adding there
        unmatchedApprovals = [.. approvals.Keys];
        unmatchedCandidates = [];

        // Go category by category
        foreach (var (type, tags) in Data)
        {
            // Get the list for this category
            var categoryList = filteredResult.GetValueOrCreateNewAddAndReturn(type);

            // Go tag by tag
            foreach (var tag in tags)
            {
                // See if we have an approval decision for this tag
                if (approvals.TryGetValue(tag, out var isApproved))
                {
                    // Remove from unmatched approvals
                    unmatchedApprovals.Remove(tag);

                    // If approved, add to result
                    if (isApproved)
                        categoryList.Add(tag);
                }
                // No approval decision found
                else unmatchedCandidates.Add(tag);
            }
        }

        // Make immutable and return
        return new SimpleTagsByCategory(
            filteredResult.ToImmutableDictionary(
                categoryEntry => categoryEntry.Key,
                categoryEntry => categoryEntry.Value.ToArray()
            )
        );
    }

    /// <summary>
    /// Removes specified tags from all categories.
    /// </summary>
    /// <param name="tagsToRemove">Collection of tags to remove</param>
    /// <returns>A new SimpleTagsByCategory with the specified tags removed</returns>
    public SimpleTagsByCategory FilterOut(IEnumerable<string> tagsToRemove) => new(
        Data.ToImmutableDictionary(
                categoryEntry => categoryEntry.Key,
                categoryEntry => categoryEntry.Value.Where(tag => !tagsToRemove.Contains(tag)).ToArray()
            ));
}

/// <summary>
/// Represents tags organized by category, where each category contains a dictionary of tags to descriptions.
/// </summary>
/// <param name="Data">Dictionary mapping tag types to dictionaries of tags to descriptions</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<TagsByCategory>))]
public record TagsByCategory(ImmutableDictionary<TagType, TagDescriptions> Data)
{
    /// <summary>
    /// Converts the categorized tags to a flat dictionary mapping tags to their type and description.
    /// </summary>
    /// <returns>A dictionary where keys are tags and values are tuples containing the <see cref="TagType"/> and description.</returns>
    public ImmutableDictionary<string, (TagType Type, string Description)> MapTagsToTheirData()
        => (from pair in Data
            from tagEntry in pair.Value.Data
            select KeyValuePair.Create(tagEntry.Key, (pair.Key, tagEntry.Value)))
           .ToImmutableDictionary();

    /// <summary>
    /// Converts this <see cref="TagsByCategory"/> to a <see cref="SimpleTagsByCategory"/> by extracting only the tags.
    /// </summary>
    /// <returns>A <see cref="SimpleTagsByCategory"/> containing the same tags but without descriptions</returns>
    public SimpleTagsByCategory Simple() => new(
        Data.ToImmutableDictionary(
            categoryEntry => categoryEntry.Key,
            categoryEntry => categoryEntry.Value.Data.Keys.ToArray())
        );
}

/// <summary>
/// Represents a decision about whether a tag should be approved or rejected.
/// </summary>
/// <param name="Approved">Whether the tag is approved</param>
/// <param name="Reason">Reason for the approval decision</param>
public record TagApprovalDecision(bool Approved, string Reason);

/// <summary>
/// Represents the fitness score and justification for a tag's appropriateness.
/// </summary>
/// <param name="GoodnessOfFit">The fitness score</param>
/// <param name="Justification">Justification for the fitness score</param>
public record TagFitness(float GoodnessOfFit, string Justification);

/// <summary>
/// Represents a collection of tags with their descriptions.
/// Uses the <see cref="GenericDictionaryWrapperConverter{T}"/> for JSON serialization.
/// </summary>
/// <param name="Data">Dictionary mapping tags to descriptions</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<TagDescriptions>))]
public record TagDescriptions(ImmutableDictionary<string, string> Data)
{
    /// <summary>
    /// Gets the description for a specific tag, or null if the tag is not found.
    /// </summary>
    /// <param name="tag">The tag identifier</param>
    /// <returns>The description of the tag, or null if not found</returns>
    public string? GetDescription(string tag) => Data.TryGetValue(tag, out var description) ? description : null;

    /// <summary>
    /// Checks if a tag exists in this collection.
    /// </summary>
    /// <param name="tag">The tag to check</param>
    /// <returns>True if the tag exists, false otherwise</returns>
    public bool ContainsTag(string tag) => Data.ContainsKey(tag);

    /// <summary>
    /// Gets all tags in this collection.
    /// </summary>
    /// <returns>A collection of all tags</returns>
    public IEnumerable<string> GetAllTags() => Data.Keys;

    /// <summary>
    /// Filters tags by description content.
    /// </summary>
    /// <param name="predicate">Predicate to test descriptions</param>
    /// <returns>A new <see cref="TagDescriptions"/> containing only tags whose descriptions match the predicate</returns>
    public TagDescriptions FilterByDescription(Func<string, bool> predicate)
        => new(Data.Where(tagEntry => predicate(tagEntry.Value)).ToImmutableDictionary());
}

/// <summary>
/// Represents tag metadata including category and description.
/// </summary>
/// <param name="Category">The category of the tag</param>
/// <param name="Description">The description of the tag</param>
public record TagMetadata(string Category, string Description);

/// <summary>
/// Represents a collection of tags with their metadata (category and description).
/// Uses the <see cref="GenericDictionaryWrapperConverter{T}"/> for JSON serialization.
/// </summary>
/// <param name="Data">Dictionary mapping tags to metadata</param>
[JsonConverter(typeof(GenericDictionaryWrapperConverter<TagMetadataCollection>))]
public record TagMetadataCollection(ImmutableDictionary<string, TagMetadata> Data)
{
    /// <summary>
    /// Gets the metadata for a specific tag, or null if the tag is not found.
    /// </summary>
    /// <param name="tag">The tag identifier</param>
    /// <returns>The <see cref="TagMetadata"/> of the tag, or null if not found</returns>
    public TagMetadata? GetMetadata(string tag) => Data.TryGetValue(tag, out var metadata) ? metadata : null;

    /// <summary>
    /// Gets all tags in a specific category.
    /// </summary>
    /// <param name="category">The category to filter by</param>
    /// <returns>A new <see cref="TagMetadataCollection"/> containing only tags in the specified category</returns>
    public TagMetadataCollection GetTagsByCategory(string category)
        => new(Data.Where(tagEntry => tagEntry.Value.Category.Equals(category)).ToImmutableDictionary());

    /// <summary>
    /// Converts this collection to a simple tag descriptions collection.
    /// </summary>
    /// <returns>A <see cref="TagDescriptions"/> containing only the tags and descriptions</returns>
    public TagDescriptions ToTagDescriptions()
        => new(Data.ToImmutableDictionary(tagEntry => tagEntry.Key, tagEntry => tagEntry.Value.Description));
}
