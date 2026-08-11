using System.Collections.Immutable;

using MathComps.Domain.Localization;
using MathComps.Domain.Resources;
using MathComps.Shared.Serialization;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// An <see cref="IDefenseCopy"/> reading its lines from <see cref="ResourcePaths.DefenseCopy"/>, once at startup.
/// The same lines are also translated in the frontend's message catalogue under <c>defense</c>, which is what the
/// chat shows before a session exists; keep the two in step, or the greeting changes wording the moment the first
/// reply lands.
/// </summary>
public sealed class DefenseCopy : IDefenseCopy
{
    /// <summary>
    /// The examiner's lines as loaded from disk, each keyed by two-letter language code.
    /// </summary>
    private readonly DefenseCopyResource _copy = File.ReadAllText(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ResourcePaths.DefenseCopy))
        .FromJson<DefenseCopyResource>();

    /// <inheritdoc/>
    public string GetOpener(Language language) => Localize(_copy.Opener, language, nameof(_copy.Opener));

    /// <summary>
    /// Picks a line's translation, failing loudly when the resource doesn't carry the language: a defense held in
    /// a voiceless examiner's language is worse than a refused one.
    /// </summary>
    /// <param name="line">The line's translations, keyed by two-letter language code.</param>
    /// <param name="language">The language to pick.</param>
    /// <param name="lineName">Which line is being picked, for the failure message.</param>
    /// <returns>The translation.</returns>
    private static string Localize(
        ImmutableDictionary<string, string> line, Language language, string lineName)
    {
        // The resource keys its translations the way the site writes locales
        var code = language.ToString().ToLowerInvariant();

        // The translation, or a failure naming exactly what is missing
        return line.GetValueOrDefault(code)
            ?? throw new InvalidOperationException(
                $"Defense copy '{lineName}' has no '{code}' translation in {ResourcePaths.DefenseCopy}.");
    }

    /// <summary>
    /// The shape of <see cref="ResourcePaths.DefenseCopy"/>.
    /// </summary>
    /// <param name="Opener">The greeting that opens every conversation, keyed by two-letter language code.</param>
    private sealed record DefenseCopyResource(ImmutableDictionary<string, string> Opener);
}
