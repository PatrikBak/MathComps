using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHostedCompetitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_handout_environment_defenses_defense_sessions_defense_sessi",
                table: "handout_environment_defenses");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "rules_accepted_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "hosted_group_id",
                table: "rounds",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "target_kind",
                table: "handout_environment_defenses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "target_kind",
                table: "defense_sessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddUniqueConstraint(
                name: "ak_defense_session_id_target_kind",
                table: "defense_sessions",
                columns: new[] { "id", "target_kind" });

            migrationBuilder.CreateTable(
                name: "hosted_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    forfeited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hosted_entries", x => x.id);
                    table.CheckConstraint("ck_hosted_entry_sat_or_forfeited", "(\"started_at\" IS NULL) <> (\"forfeited_at\" IS NULL)");
                    table.ForeignKey(
                        name: "fk_hosted_entries_rounds_round_id",
                        column: x => x.round_id,
                        principalTable: "rounds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_hosted_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hosted_groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false),
                    opens_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    closes_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    clock_minutes = table.Column<int>(type: "integer", nullable: false),
                    allows_reentry = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hosted_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "problem_defenses",
                columns: table => new
                {
                    defense_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_kind = table.Column<int>(type: "integer", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_defenses", x => x.defense_session_id);
                    table.CheckConstraint("ck_problem_defense_target_kind", "\"target_kind\" = 1");
                    table.ForeignKey(
                        name: "fk_problem_defenses_defense_sessions_defense_session_id_target",
                        columns: x => new { x.defense_session_id, x.target_kind },
                        principalTable: "defense_sessions",
                        principalColumns: new[] { "id", "target_kind" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_problem_defenses_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_rounds_hosted_group_id",
                table: "rounds",
                column: "hosted_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_handout_environment_defenses_defense_session_id_target_kind",
                table: "handout_environment_defenses",
                columns: new[] { "defense_session_id", "target_kind" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_handout_environment_defense_target_kind",
                table: "handout_environment_defenses",
                sql: "\"target_kind\" = 0");

            migrationBuilder.CreateIndex(
                name: "ix_hosted_entries_round_id",
                table: "hosted_entries",
                column: "round_id");

            migrationBuilder.CreateIndex(
                name: "ux_hosted_entry_user_id_round_id",
                table: "hosted_entries",
                columns: new[] { "user_id", "round_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_hosted_group_slug",
                table: "hosted_groups",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_defense_problem_id",
                table: "problem_defenses",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ix_problem_defenses_defense_session_id_target_kind",
                table: "problem_defenses",
                columns: new[] { "defense_session_id", "target_kind" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_handout_environment_defenses_defense_sessions_defense_sessi",
                table: "handout_environment_defenses",
                columns: new[] { "defense_session_id", "target_kind" },
                principalTable: "defense_sessions",
                principalColumns: new[] { "id", "target_kind" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_rounds_hosted_groups_hosted_group_id",
                table: "rounds",
                column: "hosted_group_id",
                principalTable: "hosted_groups",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_handout_environment_defenses_defense_sessions_defense_sessi",
                table: "handout_environment_defenses");

            migrationBuilder.DropForeignKey(
                name: "fk_rounds_hosted_groups_hosted_group_id",
                table: "rounds");

            migrationBuilder.DropTable(
                name: "hosted_entries");

            migrationBuilder.DropTable(
                name: "hosted_groups");

            migrationBuilder.DropTable(
                name: "problem_defenses");

            migrationBuilder.DropIndex(
                name: "ix_rounds_hosted_group_id",
                table: "rounds");

            migrationBuilder.DropIndex(
                name: "ix_handout_environment_defenses_defense_session_id_target_kind",
                table: "handout_environment_defenses");

            migrationBuilder.DropCheckConstraint(
                name: "ck_handout_environment_defense_target_kind",
                table: "handout_environment_defenses");

            migrationBuilder.DropUniqueConstraint(
                name: "ak_defense_session_id_target_kind",
                table: "defense_sessions");

            migrationBuilder.DropColumn(
                name: "rules_accepted_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "hosted_group_id",
                table: "rounds");

            migrationBuilder.DropColumn(
                name: "target_kind",
                table: "handout_environment_defenses");

            migrationBuilder.DropColumn(
                name: "target_kind",
                table: "defense_sessions");

            migrationBuilder.AddForeignKey(
                name: "fk_handout_environment_defenses_defense_sessions_defense_sessi",
                table: "handout_environment_defenses",
                column: "defense_session_id",
                principalTable: "defense_sessions",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
