using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminDefenseReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "admin_notes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    turn_id = table.Column<Guid>(type: "uuid", nullable: true),
                    content = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<DefenseReportCategory>(type: "defense_report_category", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admin_notes", x => x.id);
                    table.CheckConstraint("ck_admin_note_content_not_blank", "coalesce(btrim(content, E' \\t\\n\\r\\f'), '') <> ''");
                    table.ForeignKey(
                        name: "fk_admin_notes_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_admin_notes_defense_turns_session_id_turn_id",
                        columns: x => new { x.session_id, x.turn_id },
                        principalTable: "defense_turns",
                        principalColumns: new[] { "session_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_admin_notes_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "admin_session_reviews",
                columns: table => new
                {
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reviewer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_admin_session_reviews", x => new { x.session_id, x.reviewer_id });
                    table.ForeignKey(
                        name: "fk_admin_session_reviews_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_admin_session_reviews_users_reviewer_id",
                        column: x => x.reviewer_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_admin_note_author_id",
                table: "admin_notes",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_admin_note_created_at",
                table: "admin_notes",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_admin_notes_session_id_turn_id",
                table: "admin_notes",
                columns: new[] { "session_id", "turn_id" });

            migrationBuilder.CreateIndex(
                name: "ix_admin_session_reviews_reviewer_id",
                table: "admin_session_reviews",
                column: "reviewer_id");

            // Which settings a conversation ran on, as one key. Wrapped in a function rather than written inline so
            // that grouping conversations by it and filtering to one of them are provably the same expression.
            // Immutable so it can back an index once the table is big enough to want one.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION examiner_config_version(examiner_config jsonb)
                RETURNS text AS $$
                    SELECT md5(examiner_config #>> '{}')
                $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS examiner_config_version(jsonb);");

            migrationBuilder.DropTable(
                name: "admin_notes");

            migrationBuilder.DropTable(
                name: "admin_session_reviews");
        }
    }
}
