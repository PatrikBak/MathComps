using System;
using System.Collections.Generic;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProblemSelection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .Annotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "proposals",
                columns: table => new
                {
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    area = table.Column<ProposalArea>(type: "proposal_area", nullable: false),
                    recommended = table.Column<List<HostedCompetitionCategory>>(type: "hosted_competition_category[]", nullable: false),
                    is_set_aside = table.Column<bool>(type: "boolean", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposals", x => x.problem_id);
                    table.CheckConstraint("ck_proposal_number_positive", "\"number\" > 0");
                    table.ForeignKey(
                        name: "fk_proposals_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "selection_boards",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    hosted_group_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_selection_boards", x => x.id);
                    table.ForeignKey(
                        name: "fk_selection_boards_hosted_groups_hosted_group_id",
                        column: x => x.hosted_group_id,
                        principalTable: "hosted_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "proposal_comments",
                columns: table => new
                {
                    proposal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposal_comments", x => new { x.proposal_id, x.comment_id });
                    table.ForeignKey(
                        name: "fk_proposal_comments_comments_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_proposal_comments_proposals_proposal_id",
                        column: x => x.proposal_id,
                        principalTable: "proposals",
                        principalColumn: "problem_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "selection_papers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    board_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    category = table.Column<HostedCompetitionCategory>(type: "hosted_competition_category", nullable: true),
                    slot_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_selection_papers", x => x.id);
                    table.CheckConstraint("ck_selection_paper_position_non_negative", "\"position\" >= 0");
                    table.CheckConstraint("ck_selection_paper_slot_count_positive", "\"slot_count\" > 0");
                    table.ForeignKey(
                        name: "fk_selection_papers_selection_boards_board_id",
                        column: x => x.board_id,
                        principalTable: "selection_boards",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "selection_slots",
                columns: table => new
                {
                    paper_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_selection_slots", x => new { x.paper_id, x.position });
                    table.CheckConstraint("ck_selection_slot_position_non_negative", "\"position\" >= 0");
                    table.ForeignKey(
                        name: "fk_selection_slots_proposals_problem_id",
                        column: x => x.problem_id,
                        principalTable: "proposals",
                        principalColumn: "problem_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_selection_slots_selection_papers_paper_id",
                        column: x => x.paper_id,
                        principalTable: "selection_papers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_proposal_comment_comment_id",
                table: "proposal_comments",
                column: "comment_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_proposal_number",
                table: "proposals",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_selection_board_hosted_group_id",
                table: "selection_boards",
                column: "hosted_group_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_selection_paper_board_id_position",
                table: "selection_papers",
                columns: new[] { "board_id", "position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_selection_slot_problem_id",
                table: "selection_slots",
                column: "problem_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "proposal_comments");

            migrationBuilder.DropTable(
                name: "selection_slots");

            migrationBuilder.DropTable(
                name: "proposals");

            migrationBuilder.DropTable(
                name: "selection_papers");

            migrationBuilder.DropTable(
                name: "selection_boards");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
