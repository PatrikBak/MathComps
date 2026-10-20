using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryLeads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "ak_organization_categories_organization_id_id",
                table: "organization_categories",
                columns: new[] { "organization_id", "id" });

            migrationBuilder.CreateTable(
                name: "category_leads",
                columns: table => new
                {
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_category_leads", x => new { x.organization_id, x.email, x.category_id });
                    table.ForeignKey(
                        name: "fk_category_leads_organization_categories_organization_id_cate",
                        columns: x => new { x.organization_id, x.category_id },
                        principalTable: "organization_categories",
                        principalColumns: new[] { "organization_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_category_leads_organization_members_organization_id_email",
                        columns: x => new { x.organization_id, x.email },
                        principalTable: "organization_members",
                        principalColumns: new[] { "organization_id", "email" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_category_leads_organization_id_category_id",
                table: "category_leads",
                columns: new[] { "organization_id", "category_id" });

            // Every member already on MathComps' list leads each of its categories, so each keeps changing every
            // paper on its boards.
            migrationBuilder.Sql(
                """
                INSERT INTO category_leads (organization_id, email, category_id)
                SELECT m.organization_id, m.email, c.id
                FROM organization_members m
                JOIN organization_categories c ON c.organization_id = m.organization_id
                JOIN organizations o ON o.id = m.organization_id
                WHERE o.slug = 'mathcomps';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "category_leads");

            migrationBuilder.DropUniqueConstraint(
                name: "ak_organization_categories_organization_id_id",
                table: "organization_categories");
        }
    }
}
