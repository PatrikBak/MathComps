using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAttemptCompletenessVerdict : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "math_closes",
                table: "defense_turn_attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "math_complete",
                table: "defense_turn_attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "math_owed",
                table: "defense_turn_attempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            // An attempt the leak check found withholding the close had a complete solution and a reply that asked on.
            // Marking it complete keeps that verdict readable from the new columns once the old one goes.
            migrationBuilder.Sql("UPDATE defense_turn_attempts SET math_complete = TRUE WHERE withholds_close;");

            // Every other attempt recorded before the math check judged completeness says nothing either way, and
            // false and empty is how those rows already read. The defaults were only scaffolding for that, and left
            // standing they would let a hand-written insert skip a verdict.
            migrationBuilder.Sql(
                """
                ALTER TABLE defense_turn_attempts
                    ALTER COLUMN math_closes DROP DEFAULT,
                    ALTER COLUMN math_complete DROP DEFAULT,
                    ALTER COLUMN math_owed DROP DEFAULT;
                """);

            // The withheld-close verdict follows from the completeness columns.
            migrationBuilder.DropColumn(
                name: "withholds_close",
                table: "defense_turn_attempts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "withholds_close",
                table: "defense_turn_attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Rebuild the withheld-close verdict from the completeness columns before they go, and drop the
            // scaffolding default the column was added with.
            migrationBuilder.Sql(
                """
                UPDATE defense_turn_attempts SET withholds_close = math_complete AND NOT math_closes;
                ALTER TABLE defense_turn_attempts ALTER COLUMN withholds_close DROP DEFAULT;
                """);

            migrationBuilder.DropColumn(
                name: "math_closes",
                table: "defense_turn_attempts");

            migrationBuilder.DropColumn(
                name: "math_complete",
                table: "defense_turn_attempts");

            migrationBuilder.DropColumn(
                name: "math_owed",
                table: "defense_turn_attempts");
        }
    }
}
