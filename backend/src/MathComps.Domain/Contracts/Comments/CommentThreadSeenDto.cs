using MathComps.Domain.EfCoreEntities;
using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Comments;

/// <summary>
/// How far a reader has seen the discussion of one comment target, beside what somebody else posted in it since.
/// Together they say what in it is new to the reader.
/// </summary>
/// <param name="SeenUpTo">
/// The reader's <see cref="CommentSeenMark.SeenUpTo"/> on the target; null when they have seen nothing in its
/// discussion.
/// </param>
/// <param name="NewPostedAt">
/// When each comment or reply somebody other than the reader posted in the discussion was posted, for those posted in
/// a later millisecond than <paramref name="SeenUpTo"/>, oldest first; every one of them when the reader has seen
/// nothing. A reader names a mark in whole milliseconds, so a mark at a comment covers it. A deleted comment doesn't
/// count, and an edited one counts from when it was first posted.
/// </param>
public record CommentThreadSeenDto(DateTimeOffset? SeenUpTo, ImmutableList<DateTimeOffset> NewPostedAt);
