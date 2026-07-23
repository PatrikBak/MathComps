using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseSpendTokenBreakdownAndConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "cached_prompt_tokens",
                table: "defense_spends",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "reasoning_tokens",
                table: "defense_spends",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "examiner_config",
                table: "defense_sessions",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cached_prompt_tokens",
                table: "defense_spends");

            migrationBuilder.DropColumn(
                name: "reasoning_tokens",
                table: "defense_spends");

            migrationBuilder.DropColumn(
                name: "examiner_config",
                table: "defense_sessions");
        }
    }
}
