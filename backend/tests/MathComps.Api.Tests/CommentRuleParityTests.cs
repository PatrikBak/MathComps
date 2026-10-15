using MathComps.Infrastructure.Services.Comments;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the web holds a comment to the backend's limit on its length.
/// </summary>
/// <remarks>
/// The limit lives twice on purpose: the editor counts a comment against it while it is being written, and it
/// cannot read a C# constant to find out. Drift is the failure that matters, because a comment the editor lets
/// through is then refused with nothing on screen saying why.
/// </remarks>
public class CommentRuleParityTests
{
    /// <summary>
    /// Both ends stop a comment at the same length.
    /// </summary>
    [Fact]
    public void Ts_comment_limit_matches_the_backend() =>
        // The most the editor lets a comment hold is the most the backend takes
        Assert.Equal(
            ICommentService.MaxCommentChars.ToString(),
            WebSource.ReadConstant(
                RepoPaths.Resolve("web", "src", "components", "features", "comments", "model", "comment-limits.ts"),
                "MAX_CHARACTERS_PER_COMMENT"));
}
