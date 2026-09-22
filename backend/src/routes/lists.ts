import { Router, Response } from "express";
import { prisma } from "../config/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getBoardMembership } from "../utils/boardAccess";
import { z } from "zod";
import { getIO } from "../socket";
const router = Router();

router.use(requireAuth);

// ---- CREATE a card inside a list ----
const createCardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

router.post("/:listId/cards", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { listId } = req.params;

  // Step 1: find the list, so we know which board it belongs to
  const list = await prisma.list.findUnique({
    where: { id: listId },
  });

  if (!list) {
    return res.status(404).json({ error: "List not found" });
  }

  // Step 2: check the user is a member of THAT board
  const membership = await getBoardMembership(list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "List not found" });
  }

  const parseResult = createCardSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const existingCardCount = await prisma.card.count({
    where: { listId },
  });

  const card = await prisma.card.create({
    data: {
      title: parseResult.data.title,
      description: parseResult.data.description,
      position: existingCardCount,
      listId,
    },
  });
  getIO().to(`board:${list.boardId}`).emit("board-updated");
  res.status(201).json(card);
});

// ---- UPDATE a list's title ----
const updateListSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

router.patch("/:listId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { listId } = req.params;

  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) {
    return res.status(404).json({ error: "List not found" });
  }

  const membership = await getBoardMembership(list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "List not found" });
  }

  const parseResult = updateListSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  const updated = await prisma.list.update({
    where: { id: listId },
    data: { title: parseResult.data.title },
  });
  getIO().to(`board:${list.boardId}`).emit("board-updated");
  res.json(updated);
});

// ---- DELETE a list ----
router.delete("/:listId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { listId } = req.params;

  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) {
    return res.status(404).json({ error: "List not found" });
  }

  const membership = await getBoardMembership(list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "List not found" });
  }

  await prisma.list.delete({ where: { id: listId } });
  getIO().to(`board:${list.boardId}`).emit("board-updated");

  res.status(204).send();
});

// ---- UPDATE a card (title/description, or move it to a different list) ----
const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  listId: z.string().optional(),
  position: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

router.patch("/cards/:cardId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { cardId } = req.params;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true },
  });

  if (!card) {
    return res.status(404).json({ error: "Card not found" });
  }

  const membership = await getBoardMembership(card.list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Card not found" });
  }

  const parseResult = updateCardSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  if (parseResult.data.listId && parseResult.data.listId !== card.listId) {
    const destList = await prisma.list.findUnique({ where: { id: parseResult.data.listId } });
    if (!destList || destList.boardId !== card.list.boardId) {
      return res.status(400).json({ error: "Cannot move card to a list outside this board" });
    }
  }

  if (parseResult.data.assigneeId) {
    const assigneeMembership = await getBoardMembership(card.list.boardId, parseResult.data.assigneeId);
    if (!assigneeMembership) {
      return res.status(400).json({ error: "Assignee must be a member of this board" });
    }
  }

  const { dueDate, ...rest } = parseResult.data;

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...rest,
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
  });
  getIO().to(`board:${card.list.boardId}`).emit("board-updated");
  res.json(updated);
});
// ---- ATTACH a label to a card ----
router.post("/cards/:cardId/labels/:labelId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { cardId, labelId } = req.params;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true },
  });
  if (!card) {
    return res.status(404).json({ error: "Card not found" });
  }

  const membership = await getBoardMembership(card.list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Card not found" });
  }

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.boardId !== card.list.boardId) {
    return res.status(404).json({ error: "Label not found" });
  }

  await prisma.cardLabel.upsert({
    where: { cardId_labelId: { cardId, labelId } },
    create: { cardId, labelId },
    update: {},
  });

  getIO().to(`board:${card.list.boardId}`).emit("board-updated");
  res.status(204).send();
});

// ---- DETACH a label from a card ----
router.delete("/cards/:cardId/labels/:labelId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { cardId, labelId } = req.params;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true },
  });
  if (!card) {
    return res.status(404).json({ error: "Card not found" });
  }

  const membership = await getBoardMembership(card.list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Card not found" });
  }

  await prisma.cardLabel.deleteMany({
    where: { cardId, labelId },
  });

  getIO().to(`board:${card.list.boardId}`).emit("board-updated");
  res.status(204).send();
});
// ---- DELETE a card ----
router.delete("/cards/:cardId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { cardId } = req.params;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true },
  });

  if (!card) {
    return res.status(404).json({ error: "Card not found" });
  }

  const membership = await getBoardMembership(card.list.boardId, userId);
  if (!membership) {
    return res.status(404).json({ error: "Card not found" });
  }

  await prisma.card.delete({ where: { id: cardId } });
  getIO().to(`board:${card.list.boardId}`).emit("board-updated");
  res.status(204).send();
});

export default router;