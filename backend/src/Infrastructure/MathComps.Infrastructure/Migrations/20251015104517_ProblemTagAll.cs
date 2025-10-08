using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProblemTagAll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<float>(
                name: "goodness_of_fit",
                table: "problem_tag",
                type: "real",
                nullable: false,
                defaultValue: 0f,
                oldClrType: typeof(float),
                oldType: "real",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<float>(
                name: "goodness_of_fit",
                table: "problem_tag",
                type: "real",
                nullable: true,
                oldClrType: typeof(float),
                oldType: "real");
        }
    }
}
