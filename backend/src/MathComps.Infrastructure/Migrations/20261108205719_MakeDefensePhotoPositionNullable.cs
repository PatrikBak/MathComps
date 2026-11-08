using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeDefensePhotoPositionNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "position",
                table: "defense_photos",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            // Drop the 0 the column arrived with, since a photo holds no place until it goes out with a message.
            migrationBuilder.Sql("ALTER TABLE defense_photos ALTER COLUMN position DROP DEFAULT;");

            // Clear the place of every photo no message carries, whether it never went out or a rewind freed it.
            migrationBuilder.Sql("UPDATE defense_photos SET position = NULL WHERE turn_id IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "position",
                table: "defense_photos",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
