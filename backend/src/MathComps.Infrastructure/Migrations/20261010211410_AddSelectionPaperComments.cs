using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSelectionPaperComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "selection_paper_comments",
                columns: table => new
                {
                    paper_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_selection_paper_comments", x => new { x.paper_id, x.comment_id });
                    table.ForeignKey(
                        name: "fk_selection_paper_comments_comments_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_selection_paper_comments_selection_papers_paper_id",
                        column: x => x.paper_id,
                        principalTable: "selection_papers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_selection_paper_comment_comment_id",
                table: "selection_paper_comments",
                column: "comment_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "selection_paper_comments");
        }
    }
}
