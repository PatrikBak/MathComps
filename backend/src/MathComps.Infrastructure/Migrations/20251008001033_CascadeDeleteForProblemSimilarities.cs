using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CascadeDeleteForProblemSimilarities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_similarities_problems_similar_problem_id",
                table: "problem_similarities");

            migrationBuilder.AddForeignKey(
                name: "fk_problem_similarities_problems_similar_problem_id",
                table: "problem_similarities",
                column: "similar_problem_id",
                principalTable: "problems",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_similarities_problems_similar_problem_id",
                table: "problem_similarities");

            migrationBuilder.AddForeignKey(
                name: "fk_problem_similarities_problems_similar_problem_id",
                table: "problem_similarities",
                column: "similar_problem_id",
                principalTable: "problems",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
