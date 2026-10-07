namespace MathComps.Domain.Localization;

/// <summary>
/// Extension methods for <see cref="Language"/>.
/// </summary>
public static class LanguageExtensions
{
    extension(Language)
    {
        /// <summary>
        /// Picks the language somebody is written to in, from the country they compete from: Slovak for Slovakia,
        /// Czech for Czechia, English for anywhere else or nowhere said.
        /// </summary>
        /// <param name="countryCode">
        /// The ISO 3166-1 alpha-2 code of the country somebody competes from, or null while they have not said.
        /// </param>
        /// <returns>The language.</returns>
        public static Language OfCountry(string? countryCode) => countryCode switch
        {
            "SK" => Language.SK,
            "CZ" => Language.CS,
            _ => Language.EN,
        };
    }
}
