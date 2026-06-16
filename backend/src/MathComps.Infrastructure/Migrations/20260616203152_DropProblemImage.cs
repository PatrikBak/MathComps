using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropProblemImage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "problem_images");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "problem_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    height = table.Column<string>(type: "text", nullable: false),
                    original_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    scale = table.Column<decimal>(type: "numeric", nullable: false),
                    width = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_images", x => x.id);
                    table.ForeignKey(
                        name: "fk_problem_images_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_problem_image_problem_content_id",
                table: "problem_images",
                columns: new[] { "problem_id", "content_id" },
                unique: true);
        }
    }
}
