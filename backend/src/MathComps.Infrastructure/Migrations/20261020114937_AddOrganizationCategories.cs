using System;
using System.Collections.Generic;
using MathComps.Domain.Contracts.Competitions;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "organization_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    hosted_category = table.Column<HostedCompetitionCategory>(type: "hosted_competition_category", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organization_categories", x => x.id);
                    table.CheckConstraint("ck_organization_category_position_non_negative", "\"position\" >= 0");
                    table.ForeignKey(
                        name: "fk_organization_categories_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "proposal_recommendations",
                columns: table => new
                {
                    proposal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proposal_recommendations", x => new { x.proposal_id, x.category_id });
                    table.ForeignKey(
                        name: "fk_proposal_recommendations_organization_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "organization_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_proposal_recommendations_proposals_proposal_id",
                        column: x => x.proposal_id,
                        principalTable: "proposals",
                        principalColumn: "problem_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "category_id",
                table: "selection_papers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_selection_papers_category_id",
                table: "selection_papers",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ux_organization_category_organization_id_hosted_category",
                table: "organization_categories",
                columns: new[] { "organization_id", "hosted_category" },
                unique: true,
                filter: "\"hosted_category\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_organization_category_organization_id_name",
                table: "organization_categories",
                columns: new[] { "organization_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_organization_category_organization_id_position",
                table: "organization_categories",
                columns: new[] { "organization_id", "position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_proposal_recommendations_category_id",
                table: "proposal_recommendations",
                column: "category_id");

            // MathComps' categories, its hosted levels in the order they run, each named the way drafts and links name
            // them.
            migrationBuilder.Sql(
                """
                INSERT INTO organization_categories (id, organization_id, position, name, hosted_category)
                SELECT gen_random_uuid(), o.id, c.position, c.name, c.name::hosted_competition_category
                FROM organizations o
                CROSS JOIN (VALUES (0, 'elementary'), (1, 'intermediate'), (2, 'advanced')) AS c (position, name)
                WHERE o.slug = 'mathcomps';
                """);

            // Every proposal keeps its recommendations, each now MathComps' category at that level, since every
            // proposal is MathComps'.
            migrationBuilder.Sql(
                """
                INSERT INTO proposal_recommendations (proposal_id, category_id)
                SELECT p.problem_id, c.id
                FROM proposals p
                CROSS JOIN LATERAL unnest(p.recommended) AS r (level)
                JOIN organization_categories c ON c.organization_id = p.organization_id AND c.hosted_category = r.level;
                """);

            // Every paper keeps its category, MathComps' at the paper's level, since every board is MathComps'.
            migrationBuilder.Sql(
                """
                UPDATE selection_papers sp
                SET category_id = c.id
                FROM selection_boards b
                JOIN organization_categories c ON c.organization_id = b.organization_id
                WHERE b.id = sp.board_id AND c.hosted_category = sp.category;
                """);

            // The levels are rows now, so the columns holding them go.
            migrationBuilder.DropColumn(
                name: "category",
                table: "selection_papers");

            migrationBuilder.DropColumn(
                name: "recommended",
                table: "proposals");

            migrationBuilder.AddForeignKey(
                name: "fk_selection_papers_organization_categories_category_id",
                table: "selection_papers",
                column: "category_id",
                principalTable: "organization_categories",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_selection_papers_organization_categories_category_id",
                table: "selection_papers");

            migrationBuilder.DropTable(
                name: "proposal_recommendations");

            migrationBuilder.DropTable(
                name: "organization_categories");

            migrationBuilder.DropIndex(
                name: "ix_selection_papers_category_id",
                table: "selection_papers");

            migrationBuilder.DropColumn(
                name: "category_id",
                table: "selection_papers");

            migrationBuilder.AddColumn<HostedCompetitionCategory>(
                name: "category",
                table: "selection_papers",
                type: "hosted_competition_category",
                nullable: true);

            migrationBuilder.AddColumn<List<HostedCompetitionCategory>>(
                name: "recommended",
                table: "proposals",
                type: "hosted_competition_category[]",
                nullable: false);
        }
    }
}
