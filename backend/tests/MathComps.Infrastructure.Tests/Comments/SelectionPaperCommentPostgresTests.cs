using MathComps.Domain.Contracts.Comments;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Tests.TestInfrastructure;

namespace MathComps.Infrastructure.Tests.Comments;

/// <summary>
/// The <see cref="PreparerCommentPostgresTests"/> for a paper's discussion, the reviewers' thread about one paper on a
/// board of the problem selection.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class SelectionPaperCommentPostgresTests(PostgresContainerFixture fixture)
    : PreparerCommentPostgresTests(fixture)
{
    /// <inheritdoc/>
    protected override CommentTargetType TargetType => CommentTargetType.SelectionPaper;

    /// <inheritdoc/>
    protected override void SeedSubjects(MathCompsDbContext context)
    {
        // A board with its papers, every slot empty
        var board = SelectionSeed.NewBoard(context, "November");

        // The board's papers, in their order
        var paperIds = context.SelectionPapers.Local
            .Where(paper => paper.BoardId == board.Id)
            .OrderBy(paper => paper.Position)
            .Select(paper => paper.Id)
            .ToList();

        // The board's first two papers
        SubjectId = paperIds[0];
        OtherSubjectId = paperIds[1];
    }
}
