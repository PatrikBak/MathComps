using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "name",
                table: "organizations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // MathComps and the olympiad get the names their members know them by, and any other organization takes
            // its slug as its name until somebody names it, so none is left with a blank one.
            migrationBuilder.Sql(
                """
                UPDATE organizations
                SET name = CASE slug
                    WHEN 'mathcomps' THEN 'MathComps'
                    WHEN 'olympiad' THEN 'Olympiáda'
                    ELSE slug
                END;
                """);

            // The default was only ever scaffolding for the fill above, and left standing it would let a hand-written
            // insert create an organization with no name.
            migrationBuilder.Sql("ALTER TABLE organizations ALTER COLUMN name DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "name",
                table: "organizations");
        }
    }
}
