using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NumberProposalsPerOrganization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_proposals_organization_id",
                table: "proposals");

            migrationBuilder.DropIndex(
                name: "ux_proposal_number",
                table: "proposals");

            migrationBuilder.CreateIndex(
                name: "ux_proposal_organization_number",
                table: "proposals",
                columns: new[] { "organization_id", "number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_proposal_organization_number",
                table: "proposals");

            migrationBuilder.CreateIndex(
                name: "ix_proposals_organization_id",
                table: "proposals",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ux_proposal_number",
                table: "proposals",
                column: "number",
                unique: true);
        }
    }
}
