using System.Collections.Immutable;

namespace MathComps.Domain.ApiDtos.Comments;

/// <summary>
/// Response containing a list of threaded comments.
/// </summary>
/// <param name="Comments">Top-level comments with nested replies.</param>
public record GetCommentsResponse(ImmutableList<CommentDto> Comments);
