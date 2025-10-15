namespace MathComps.Domain.ApiDtos.SearchBar;

/// <summary>
/// Type of contest selection
/// </summary>
public enum ContestSelectionType
{
    /// <summary>
    /// Entire competition is selected (includes all categories and rounds)
    /// </summary>
    Competition,

    /// <summary>
    /// Entire category within a competition is selected (includes all rounds in that category)
    /// </summary>
    Category,

    /// <summary>
    /// Individual round is selected (either within a category or as a direct round)
    /// </summary>
    Round,
}
