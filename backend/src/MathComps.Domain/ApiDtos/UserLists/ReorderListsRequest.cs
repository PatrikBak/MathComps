using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.UserLists;

/// <summary>
/// Request to reorder all user lists at once.
/// </summary>
/// <param name="ContentIds">Ordered list of all user list content IDs (first = sort order 1).</param>
public record ReorderListsRequest(ImmutableList<string> ContentIds);
