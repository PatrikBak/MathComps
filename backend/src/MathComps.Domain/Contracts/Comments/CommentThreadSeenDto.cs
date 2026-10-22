using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// How far a reader has seen the discussion of one comment target, beside when somebody else last posted in it.
/// Together they say whether anything in it is new to the reader.
/// </summary>
/// <param name="SeenUpTo">
/// The reader's <see cref="CommentSeenMark.SeenUpTo"/> on the target; null when they have seen nothing in its
/// discussion.
/// </param>
/// <param name="LastPostedByOthersAt">
/// When somebody other than the reader last posted a comment or reply in the discussion; null when nobody else has.
/// A deleted comment doesn't count, and an edited one counts from when it was first posted.
/// </param>
public record CommentThreadSeenDto(DateTimeOffset? SeenUpTo, DateTimeOffset? LastPostedByOthersAt);
