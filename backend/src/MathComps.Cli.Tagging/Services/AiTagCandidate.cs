using MathComps.Domain.Tagging;

namespace MathComps.Cli.Tagging.Services;

/// <summary>
/// A single tag offered to the AI as a candidate, identified by its AI-language (English) display name — the AI sees
/// and returns names, which we map back to slugs.
/// </summary>
/// <param name="Slug">The canonical slug the name resolves to.</param>
/// <param name="Name">The AI-language display name shown to and returned by the model.</param>
/// <param name="Type">The tag's category.</param>
/// <param name="Description">The vocabulary description that helps the model judge fit.</param>
/// <param name="Justification">The proposed tag's reason — set only for the veto pass, null when generating.</param>
public record AiTagCandidate(string Slug, string Name, TagType Type, string Description, string? Justification = null);
