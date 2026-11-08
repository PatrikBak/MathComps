using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LinkDefensePhotosToTurns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "position",
                table: "defense_photos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "turn_id",
                table: "defense_photos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_defense_photo_turn_id_position",
                table: "defense_photos",
                columns: new[] { "turn_id", "position" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_defense_photos_defense_turns_turn_id",
                table: "defense_photos",
                column: "turn_id",
                principalTable: "defense_turns",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_defense_photos_defense_turns_turn_id",
                table: "defense_photos");

            migrationBuilder.DropIndex(
                name: "ux_defense_photo_turn_id_position",
                table: "defense_photos");

            migrationBuilder.DropColumn(
                name: "position",
                table: "defense_photos");

            migrationBuilder.DropColumn(
                name: "turn_id",
                table: "defense_photos");
        }
    }
}
