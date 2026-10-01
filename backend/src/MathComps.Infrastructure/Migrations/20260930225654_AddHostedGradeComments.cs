using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHostedGradeComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hosted_grade_comments",
                columns: table => new
                {
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hosted_grade_comments", x => new { x.entry_id, x.problem_id, x.comment_id });
                    table.ForeignKey(
                        name: "fk_hosted_grade_comments_comments_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_hosted_grade_comments_hosted_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "hosted_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_hosted_grade_comments_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_hosted_grade_comments_problem_id",
                table: "hosted_grade_comments",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ux_hosted_grade_comment_comment_id",
                table: "hosted_grade_comments",
                column: "comment_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hosted_grade_comments");
        }
    }
}
