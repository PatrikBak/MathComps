using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaggingMetadataToProblemTag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_problem_tag_tag_problem",
                table: "problem_tag");

            migrationBuilder.AddColumn<int>(
                name: "confidence",
                table: "problem_tag",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "goodness_of_fit",
                table: "problem_tag",
                type: "real",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "justification",
                table: "problem_tag",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_tag_problem_id",
                table: "problem_tag",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ix_problem_tag_tag_id",
                table: "problem_tag",
                column: "tag_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_problem_tag_problem_id",
                table: "problem_tag");

            migrationBuilder.DropIndex(
                name: "ix_problem_tag_tag_id",
                table: "problem_tag");

            migrationBuilder.DropColumn(
                name: "confidence",
                table: "problem_tag");

            migrationBuilder.DropColumn(
                name: "goodness_of_fit",
                table: "problem_tag");

            migrationBuilder.DropColumn(
                name: "justification",
                table: "problem_tag");

            migrationBuilder.CreateIndex(
                name: "ix_problem_tag_tag_problem",
                table: "problem_tag",
                columns: new[] { "tag_id", "problem_id" });
        }
    }
}
