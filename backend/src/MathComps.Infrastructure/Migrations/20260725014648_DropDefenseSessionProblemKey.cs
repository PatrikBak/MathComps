using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropDefenseSessionProblemKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_defense_session_user_id_problem_key",
                table: "defense_sessions");

            migrationBuilder.DropColumn(
                name: "problem_key",
                table: "defense_sessions");

            migrationBuilder.CreateIndex(
                name: "ix_defense_session_user_id",
                table: "defense_sessions",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_defense_session_user_id",
                table: "defense_sessions");

            migrationBuilder.AddColumn<string>(
                name: "problem_key",
                table: "defense_sessions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_defense_session_user_id_problem_key",
                table: "defense_sessions",
                columns: new[] { "user_id", "problem_key" });
        }
    }
}
