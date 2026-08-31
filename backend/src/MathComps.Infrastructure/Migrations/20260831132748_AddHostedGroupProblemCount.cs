using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHostedGroupProblemCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "problem_count",
                table: "hosted_groups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Until now the number came off whichever round sorted first, so every standing group keeps exactly
            // the count it has been showing. Nothing lands on zero and trips the constraint below: a group was
            // refused a manifest naming no rounds, and refused one whose rounds held no problems, so every group
            // this runs over has a full first round.
            migrationBuilder.Sql(
                """
                UPDATE hosted_groups AS g
                SET problem_count = (
                    SELECT count(*)
                    FROM problems AS p
                    WHERE p.round_id = (
                        SELECT r.id
                        FROM rounds AS r
                        JOIN competitions AS c ON c.id = r.competition_id
                        WHERE r.hosted_group_id = g.id
                        ORDER BY c.sort_path
                        LIMIT 1));
                """);

            // The default was only ever scaffolding for the backfill above. Left standing it would let a hand-written
            // insert put a group on the site announcing nothing, which the constraint below is there to forbid.
            migrationBuilder.Sql("ALTER TABLE hosted_groups ALTER COLUMN problem_count DROP DEFAULT;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_hosted_group_problem_count_positive",
                table: "hosted_groups",
                sql: "\"problem_count\" > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_hosted_group_problem_count_positive",
                table: "hosted_groups");

            migrationBuilder.DropColumn(
                name: "problem_count",
                table: "hosted_groups");
        }
    }
}
