import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./setup";

// Small helper: creates a board, a list, and a card, all owned by the
// given token, and returns their ids - avoids repeating this 3-step
// setup in every test below.
async function createBoardWithCard(token: string, boardTitle = "Test Board") {
  const board = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: boardTitle });

  const list = await request(app)
    .post(`/api/boards/${board.body.id}/lists`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "To Do" });

  const card = await request(app)
    .post(`/api/lists/${list.body.id}/cards`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Test card" });

  return { boardId: board.body.id as string, listId: list.body.id as string, cardId: card.body.id as string };
}

describe("Card assignee validation", () => {
  it("allows assigning a card to a board member", async () => {
    const { token: ownerToken, userId: ownerId } = await createTestUser("cardowner1@example.com");
    const { boardId, cardId } = await createBoardWithCard(ownerToken);

    const res = await request(app)
      .patch(`/api/lists/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeId: ownerId });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(ownerId);
  });

  it("rejects assigning a card to someone who isn't a board member", async () => {
    const { token: ownerToken } = await createTestUser("cardowner2@example.com");
    const { userId: outsiderId } = await createTestUser("outsider@example.com");
    const { cardId } = await createBoardWithCard(ownerToken);

    const res = await request(app)
      .patch(`/api/lists/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeId: outsiderId });

    expect(res.status).toBe(400);
  });

  it("allows clearing an assignee back to unassigned", async () => {
    const { token: ownerToken, userId: ownerId } = await createTestUser("cardowner3@example.com");
    const { cardId } = await createBoardWithCard(ownerToken);

    await request(app)
      .patch(`/api/lists/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeId: ownerId });

    const res = await request(app)
      .patch(`/api/lists/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBeNull();
  });
});

describe("Label scoping to a board", () => {
  it("rejects attaching a label from a different board to a card", async () => {
    const { token } = await createTestUser("labelowner@example.com");
    const { cardId } = await createBoardWithCard(token, "Board A");

    // Create a SECOND, unrelated board and a label that lives there
    const otherBoard = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board B" });

    const otherLabel = await request(app)
      .post(`/api/boards/${otherBoard.body.id}/labels`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Wrong Board Label", color: "#ef4444" });

    // Try to attach Board B's label to a card that lives on Board A
    const res = await request(app)
      .post(`/api/lists/cards/${cardId}/labels/${otherLabel.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("allows attaching a label that belongs to the same board", async () => {
    const { token } = await createTestUser("labelowner2@example.com");
    const { boardId, cardId } = await createBoardWithCard(token);

    const label = await request(app)
      .post(`/api/boards/${boardId}/labels`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bug", color: "#f59e0b" });

    const res = await request(app)
      .post(`/api/lists/cards/${cardId}/labels/${label.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});