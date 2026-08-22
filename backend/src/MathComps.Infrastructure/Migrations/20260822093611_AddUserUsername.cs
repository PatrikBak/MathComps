using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserUsername : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "username",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // A username is one person's however they capitalized it, so uniqueness is enforced over the folded
            // form. EF cannot express an expression index, which is why this is written out.
            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX ux_user_username_lower
                ON users (lower(username))
                WHERE username IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ux_user_username_lower;");

            migrationBuilder.DropColumn(
                name: "username",
                table: "users");
        }
    }
}
