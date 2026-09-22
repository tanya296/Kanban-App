import { prisma } from "../config/db";

// Returns the BoardMember row if the user belongs to this board, otherwise null.
// We'll use this inside routes to decide: allow, or reject with 403/404.
export async function getBoardMembership(boardId: string, userId: string) {
  return prisma.boardMember.findUnique({
    where: {
      boardId_userId: {
        boardId,
        userId,
      },
    },
  });
}