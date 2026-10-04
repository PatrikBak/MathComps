using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameCapabilityToPrepareCompetitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Renamed in place, so every grant keeps its row; a scaffolded enum change would try to drop the old label
            migrationBuilder.Sql(
                "ALTER TYPE user_capability RENAME VALUE 'bypass_competition_gates' TO 'prepare_competitions';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The label back under its old name
            migrationBuilder.Sql(
                "ALTER TYPE user_capability RENAME VALUE 'prepare_competitions' TO 'bypass_competition_gates';");
        }
    }
}
