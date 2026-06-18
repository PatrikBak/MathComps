using MathComps.Cli.Tagging.Dtos;
using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// The outcome of one generate pass: the proposed tags keyed by slug, plus any names the model returned that fall
/// outside the candidate vocabulary.
/// </summary>
/// <param name="TagsBySlug">Proposed tags with their fitness, keyed by canonical slug.</param>
/// <param name="UnknownNames">Names the model returned that resolve to no approved slug.</param>
public record SuggestTagsResult(
    ImmutableDictionary<string, TagFitness> TagsBySlug,
    ImmutableArray<string> UnknownNames);
