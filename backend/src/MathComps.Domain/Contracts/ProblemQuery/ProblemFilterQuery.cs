namespace MathComps.Domain.Contracts.ProblemQuery;

/// <inheritdoc cref="FilterQuery" path="/summary"/>
/// <param name="Parameters"><inheritdoc cref="FilterQuery" path="/param[@name='Parameters']"/></param>
/// <param name="PageSize"><inheritdoc cref="FilterQuery" path="/param[@name='PageSize']"/></param>
/// <param name="PageNumber"><inheritdoc cref="FilterQuery" path="/param[@name='PageNumber']"/></param>
/// <param name="FavoritesOnly"><inheritdoc cref="FilterQuery" path="/param[@name='FavoritesOnly']"/></param>
/// <param name="ListContentId"><inheritdoc cref="FilterQuery" path="/param[@name='ListContentId']"/></param>
/// <param name="MarkStatus"><inheritdoc cref="FilterQuery" path="/param[@name='MarkStatus']"/></param>
public record ProblemFilterQuery(
    ProblemFilterCriteria Parameters,
    int PageSize,
    int PageNumber,
    bool FavoritesOnly,
    string? ListContentId = null,
    MarkStatusFilter? MarkStatus = null
);
