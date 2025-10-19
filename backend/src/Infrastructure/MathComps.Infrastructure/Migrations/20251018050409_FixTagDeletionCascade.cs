using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixTagDeletionCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_tag_tags_tag_id",
                table: "problem_tag");

            migrationBuilder.AddForeignKey(
                name: "fk_problem_tag_tags_tag_id",
                table: "problem_tag",
                column: "tag_id",
                principalTable: "tags",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_tag_tags_tag_id",
                table: "problem_tag");

            migrationBuilder.AddForeignKey(
                name: "fk_problem_tag_tags_tag_id",
                table: "problem_tag",
                column: "tag_id",
                principalTable: "tags",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
