using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// Request for getting comment counts for multiple targets of the same type.
/// </summary>
/// <param name="TargetType">The type of targets.</param>
/// <param name="TargetIds">The list of ids to get counts for.</param>
public record GetCommentCountsRequest(
    CommentTargetType TargetType,
    ImmutableList<string> TargetIds
);
