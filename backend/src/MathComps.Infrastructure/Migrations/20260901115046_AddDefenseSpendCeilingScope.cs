using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseSpendCeilingScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every spend written so far was weighed against the daily ceiling, and this default is what says so
            // for the rows already there.
            migrationBuilder.AddColumn<bool>(
                name: "counts_against_ceiling",
                table: "defense_spends",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // The default was only ever scaffolding for that backfill. Left standing, a later insert would inherit
            // it silently instead of saying which kind of spend it is.
            migrationBuilder.Sql("ALTER TABLE defense_spends ALTER COLUMN counts_against_ceiling DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "counts_against_ceiling",
                table: "defense_spends");
        }
    }
}
