namespace MathComps.TexParser.Types;

/// <summary>
/// Represents different styles of list item markers used in TeX documents.
/// </summary>
public enum ListItemStyle
{
    /// <summary>
    /// Default style
    /// </summary>
    Bullet,

    /// <summary>
    /// Lowercase Roman numerals with parentheses, e.g. (i)
    /// </summary>
    LowerRomanParens,

    /// <summary>
    /// Lowercase letters with parentheses, e.g. (a)
    /// </summary>
    LowerAlphaParens,

    /// <summary>
    /// Uppercase letters with parentheses, e.g. (A)
    /// </summary>
    UpperAlphaParens,

    /// <summary>
    /// Numbers with dots, e.g. 1.
    /// </summary>
    NumberDot,

    /// <summary>
    /// Numbers with parentheses, e.g. (I)
    /// </summary>
    NumberParens,

    /// <summary>
    /// Uppercase Roman numerals with colon, e.g. I:
    /// </summary>
    UpperRoman,
}
