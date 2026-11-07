using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefensePhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "photo_id",
                table: "defense_spends",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "defense_photos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_photos", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_photos_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "defense_photo_crops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    photo_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "text", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_photo_crops", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_photo_crops_defense_photos_photo_id",
                        column: x => x.photo_id,
                        principalTable: "defense_photos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_defense_spend_reading_has_no_revisions",
                table: "defense_spends",
                sql: "\"photo_id\" IS NULL OR \"revisions\" = 0");

            migrationBuilder.CreateIndex(
                name: "ux_defense_photo_crop_photo_id_position",
                table: "defense_photo_crops",
                columns: new[] { "photo_id", "position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_defense_photos_user_id",
                table: "defense_photos",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "defense_photo_crops");

            migrationBuilder.DropTable(
                name: "defense_photos");

            migrationBuilder.DropCheckConstraint(
                name: "ck_defense_spend_reading_has_no_revisions",
                table: "defense_spends");

            migrationBuilder.DropColumn(
                name: "photo_id",
                table: "defense_spends");
        }
    }
}
