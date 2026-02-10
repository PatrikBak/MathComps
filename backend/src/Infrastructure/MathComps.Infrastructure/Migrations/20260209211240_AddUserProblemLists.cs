using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProblemLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_problem_lists",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    content_id = table.Column<string>(type: "character varying(21)", maxLength: 21, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_shared = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_problem_lists", x => x.id);
                    table.CheckConstraint("ck_user_problem_list_sort_order_positive", "\"sort_order\" > 0");
                    table.ForeignKey(
                        name: "fk_user_problem_lists_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_problem_list_items",
                columns: table => new
                {
                    list_id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_problem_list_items", x => new { x.list_id, x.problem_id });
                    table.ForeignKey(
                        name: "fk_user_problem_list_items_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_problem_list_items_user_problem_lists_list_id",
                        column: x => x.list_id,
                        principalTable: "user_problem_lists",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_problem_list_item_problem_id",
                table: "user_problem_list_items",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_problem_list_user_id",
                table: "user_problem_lists",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ux_user_problem_list_content_id",
                table: "user_problem_lists",
                column: "content_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_problem_list_items");

            migrationBuilder.DropTable(
                name: "user_problem_lists");
        }
    }
}
