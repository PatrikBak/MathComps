using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHostedGrades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hosted_grades",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mark = table.Column<int>(type: "integer", nullable: true),
                    help = table.Column<int>(type: "integer", nullable: false),
                    internal_comment = table.Column<string>(type: "text", nullable: false),
                    is_final = table.Column<bool>(type: "boolean", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hosted_grades", x => x.id);
                    table.CheckConstraint("ck_hosted_grade_final_has_mark", "NOT \"is_final\" OR \"mark\" IS NOT NULL");
                    table.CheckConstraint("ck_hosted_grade_help_within_mark", "\"help\" BETWEEN 0 AND coalesce(\"mark\", 0)");
                    table.CheckConstraint("ck_hosted_grade_mark_in_range", "\"mark\" BETWEEN 0 AND 100");
                    table.ForeignKey(
                        name: "fk_hosted_grades_hosted_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "hosted_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_hosted_grades_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_hosted_grades_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_hosted_grades_author_id",
                table: "hosted_grades",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_hosted_grades_problem_id",
                table: "hosted_grades",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ux_hosted_grade_entry_id_problem_id_created_at",
                table: "hosted_grades",
                columns: new[] { "entry_id", "problem_id", "created_at" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hosted_grades");
        }
    }
}
