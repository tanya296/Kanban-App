import { Router, Response } from "express";
import { prisma } from "../config/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { getBoardMembership } from "../utils/boardAccess";
import { getIO } from "../socket";
const router = Router();

router.use(requireAuth);

// ---- CREATE a board ----
const createBoardSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parseResult = createBoardSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const userId = req.userId!;
  const { title } = parseResult.data;

  const board = await prisma.board.create({
    data: {
      title,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "owner",
        },
      },
    },
    include: {
      members: true,
    },
  });

  res.status(201).json(board);
});

// ---- LIST boards the user belongs to ----
router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const boards = await prisma.board.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(boards);
});

// ---- GET one board (with its lists and cards), only if the user is a member ----
router.get("/:boardId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: {
              assignee: {
                select: { id: true, name: true, email: true },
              },
              labels: {
                include: { label: true },
              },
            },
          },
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      labels: {
        orderBy: { name: "asc" },
      },
    },
  });

  res.json(board);
});

// ---- CREATE a label for a board (any member can add labels) ----
const createLabelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #f59e0b"),
});

router.post("/:boardId/labels", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  const parseResult = createLabelSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const label = await prisma.label.create({
    data: {
      name: parseResult.data.name,
      color: parseResult.data.color,
      boardId,
    },
  });

  getIO().to(`board:${boardId}`).emit("board-updated");
  res.status(201).json(label);
});

// ---- DELETE a label from a board ----
router.delete("/:boardId/labels/:labelId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId, labelId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  // Make sure the label actually belongs to THIS board, not some
  // other board the labelId happens to reference.
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.boardId !== boardId) {
    return res.status(404).json({ error: "Label not found" });
  }

  // Deleting the label also cascades to remove any CardLabel rows
  // pointing at it (from the schema's onDelete: Cascade), so cards
  // that had this label just silently lose it - no orphaned rows.
  await prisma.label.delete({ where: { id: labelId } });

  getIO().to(`board:${boardId}`).emit("board-updated");
  res.status(204).send();
});

// ---- CREATE a list inside a board ----
const createListSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

router.post("/:boardId/lists", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  const parseResult = createListSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  // Position = how many lists already exist on this board.
  // So the first list gets position 0, second gets 1, etc.
  // This keeps lists ordered left-to-right in the UI later.
  const existingListCount = await prisma.list.count({
    where: { boardId },
  });

  const list = await prisma.list.create({
    data: {
      title: parseResult.data.title,
      position: existingListCount,
      boardId,
    },
  });

  res.status(201).json(list);
});
// ---- UPDATE a board's title ----
const updateBoardSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

router.patch("/:boardId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  const parseResult = updateBoardSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { title: parseResult.data.title },
  });
  getIO().to(`board:${boardId}`).emit("board-updated");
  res.json(updated);
});

// ---- DELETE a board (owner only) ----
router.delete("/:boardId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  // Deleting a board is destructive - only the OWNER should be allowed,
  // not just any member. This is different from the other checks above,
  // which only required *any* membership.
  if (membership.role !== "owner") {
    return res.status(403).json({ error: "Only the board owner can delete this board" });
  }

  await prisma.board.delete({
    where: { id: boardId },
  });
  getIO().to(`board:${boardId}`).emit("board-updated");
  res.status(204).send();
});
// ---- INVITE a member to a board, by email ----
const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

router.post("/:boardId/members", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId } = req.params;

  // Only existing members can invite others
  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  const parseResult = inviteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const invitedUser = await prisma.user.findUnique({
    where: { email: parseResult.data.email },
  });

  if (!invitedUser) {
    return res.status(404).json({ error: "No user found with that email" });
  }

  // Prevent adding someone who's already a member
  const alreadyMember = await getBoardMembership(boardId, invitedUser.id);
  if (alreadyMember) {
    return res.status(400).json({ error: "This user is already a member of the board" });
  }

  const newMember = await prisma.boardMember.create({
    data: {
      boardId,
      userId: invitedUser.id,
      role: "member",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  getIO().to(`board:${boardId}`).emit("board-updated");
  res.status(201).json(newMember);
});

// ---- REMOVE a member from a board (owner only) ----
router.delete("/:boardId/members/:memberUserId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { boardId, memberUserId } = req.params;

  const membership = await getBoardMembership(boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Board not found" });
  }

  if (membership.role !== "owner") {
    return res.status(403).json({ error: "Only the board owner can remove members" });
  }

  // Prevent the owner from removing themselves this way -
  // that should go through "delete board" instead, to avoid a board
  // ending up with no owner at all.
  if (memberUserId === userId) {
    return res.status(400).json({ error: "Owner cannot remove themselves from the board" });
  }

  await prisma.boardMember.delete({
    where: {
      boardId_userId: {
        boardId,
        userId: memberUserId,
      },
    },
  });

  getIO().to(`board:${boardId}`).emit("board-updated");
  res.status(204).send();
});
export default router;