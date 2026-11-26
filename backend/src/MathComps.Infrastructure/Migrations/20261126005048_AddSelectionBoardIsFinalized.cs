using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSelectionBoardIsFinalized : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_finalized",
                table: "selection_boards",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Until now a board tied to a group was a finalized one, so every board with a group is finalized and
            // every other one a draft.
            migrationBuilder.Sql("UPDATE selection_boards SET is_finalized = TRUE WHERE hosted_group_id IS NOT NULL;");

            // The default was only ever scaffolding for the backfill above. Left standing it would let a
            // hand-written insert make a board without saying whether it is finalized.
            migrationBuilder.Sql("ALTER TABLE selection_boards ALTER COLUMN is_finalized DROP DEFAULT;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_selection_board_finalized_has_group",
                table: "selection_boards",
                sql: "NOT \"is_finalized\" OR \"hosted_group_id\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_selection_board_finalized_has_group",
                table: "selection_boards");

            migrationBuilder.DropColumn(
                name: "is_finalized",
                table: "selection_boards");
        }
    }
}
