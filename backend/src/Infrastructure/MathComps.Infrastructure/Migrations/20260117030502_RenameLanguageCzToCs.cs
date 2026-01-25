using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameLanguageCzToCs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
            // Rename PostgreSQL enum value from 'cz' to 'cs' to match ISO 639-1 code for Czech
            => migrationBuilder.Sql("ALTER TYPE language RENAME VALUE 'cz' TO 'cs';");

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
            // Revert: rename 'cs' back to 'cz'
            => migrationBuilder.Sql("ALTER TYPE language RENAME VALUE 'cs' TO 'cz';");
    }
}
