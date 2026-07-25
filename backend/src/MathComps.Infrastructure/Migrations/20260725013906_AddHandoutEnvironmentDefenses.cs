using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHandoutEnvironmentDefenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "handout_environments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    handout_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_handout_environments", x => x.id);
                    table.ForeignKey(
                        name: "fk_handout_environments_handouts_handout_id",
                        column: x => x.handout_id,
                        principalTable: "handouts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "handout_environment_defenses",
                columns: table => new
                {
                    defense_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    handout_environment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_handout_environment_defenses", x => x.defense_session_id);
                    table.ForeignKey(
                        name: "fk_handout_environment_defenses_defense_sessions_defense_sessi",
                        column: x => x.defense_session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_handout_environment_defenses_handout_environments_handout_e",
                        column: x => x.handout_environment_id,
                        principalTable: "handout_environments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_handout_environment_defense_handout_environment_id",
                table: "handout_environment_defenses",
                column: "handout_environment_id");

            migrationBuilder.CreateIndex(
                name: "ux_handout_environment_handout_id_content_id",
                table: "handout_environments",
                columns: new[] { "handout_id", "content_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "handout_environment_defenses");

            migrationBuilder.DropTable(
                name: "handout_environments");
        }
    }
}
