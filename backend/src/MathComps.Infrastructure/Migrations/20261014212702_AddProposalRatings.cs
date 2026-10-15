using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "proposal_ratings",
                columns: table => new
                {
                    proposal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    beauty = table.Column<int>(type: "integer", nullable: true),
                    difficulty = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposal_ratings", x => new { x.proposal_id, x.user_id });
                    table.CheckConstraint("ck_proposal_rating_beauty_in_range", "\"beauty\" BETWEEN 1 AND 5");
                    table.CheckConstraint("ck_proposal_rating_difficulty_in_range", "\"difficulty\" BETWEEN 1 AND 5");
                    table.CheckConstraint("ck_proposal_rating_has_a_score", "\"beauty\" IS NOT NULL OR \"difficulty\" IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_proposal_ratings_proposals_proposal_id",
                        column: x => x.proposal_id,
                        principalTable: "proposals",
                        principalColumn: "problem_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_proposal_ratings_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_proposal_ratings_user_id",
                table: "proposal_ratings",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "proposal_ratings");
        }
    }
}
