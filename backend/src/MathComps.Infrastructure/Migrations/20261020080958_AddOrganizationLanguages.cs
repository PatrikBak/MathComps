using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationLanguages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "needs_every_language",
                table: "organizations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // MathComps' problems go into the hosted rounds, so they need every language.
            migrationBuilder.Sql("UPDATE organizations SET needs_every_language = true WHERE slug = 'mathcomps';");

            // The default was only ever scaffolding for the fill above, so it goes.
            migrationBuilder.Sql("ALTER TABLE organizations ALTER COLUMN needs_every_language DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "needs_every_language",
                table: "organizations");
        }
    }
}
