using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefensePhotoHandoffs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "defense_photo_handoff_pages",
                columns: table => new
                {
                    photo_id = table.Column<Guid>(type: "uuid", nullable: false),
                    handout_environment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: true),
                    captured_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    taken_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_photo_handoff_pages", x => x.photo_id);
                    table.CheckConstraint("ck_defense_photo_handoff_page_one_target", "num_nonnulls(\"handout_environment_id\", \"problem_id\") = 1");
                    table.ForeignKey(
                        name: "fk_defense_photo_handoff_pages_defense_photos_photo_id",
                        column: x => x.photo_id,
                        principalTable: "defense_photos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_defense_photo_handoff_pages_handout_environments_handout_en",
                        column: x => x.handout_environment_id,
                        principalTable: "handout_environments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_defense_photo_handoff_pages_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "defense_photo_handoffs",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    handout_environment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_photo_handoffs", x => x.user_id);
                    table.CheckConstraint("ck_defense_photo_handoff_one_target", "num_nonnulls(\"handout_environment_id\", \"problem_id\") = 1");
                    table.ForeignKey(
                        name: "fk_defense_photo_handoffs_handout_environments_handout_environ",
                        column: x => x.handout_environment_id,
                        principalTable: "handout_environments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_defense_photo_handoffs_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_defense_photo_handoffs_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_defense_photo_handoff_pages_handout_environment_id",
                table: "defense_photo_handoff_pages",
                column: "handout_environment_id");

            migrationBuilder.CreateIndex(
                name: "ix_defense_photo_handoff_pages_problem_id",
                table: "defense_photo_handoff_pages",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ix_defense_photo_handoffs_handout_environment_id",
                table: "defense_photo_handoffs",
                column: "handout_environment_id");

            migrationBuilder.CreateIndex(
                name: "ix_defense_photo_handoffs_problem_id",
                table: "defense_photo_handoffs",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ux_defense_photo_handoff_code",
                table: "defense_photo_handoffs",
                column: "code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "defense_photo_handoff_pages");

            migrationBuilder.DropTable(
                name: "defense_photo_handoffs");
        }
    }
}
