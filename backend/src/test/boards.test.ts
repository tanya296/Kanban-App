import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./setup";

describe("Board creation and access", () => {
  it("creates a board and makes the creator the owner", async () => {
    const { token } = await createTestUser("owner@example.com");

    const res = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My Board" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("My Board");
    expect(res.body.members[0].role).toBe("owner");
  });

  it("returns 404 (not 403) when a non-member tries to view a board", async () => {
    const { token: ownerToken } = await createTestUser("owner2@example.com");
    const { token: strangerToken } = await createTestUser("stranger@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Private Board" });

    const res = await request(app)
      .get(`/api/boards/${board.body.id}`)
      .set("Authorization", `Bearer ${strangerToken}`);

    // 404 rather than 403 is deliberate - it avoids confirming to a
    // non-member that a board with this id even exists.
    expect(res.status).toBe(404);
  });

  it("lets a member view a board they belong to", async () => {
    const { token } = await createTestUser("member@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My Board" });

    const res = await request(app)
      .get(`/api/boards/${board.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("My Board");
  });
});

describe("Board deletion - owner only", () => {
  it("allows the owner to delete their board", async () => {
    const { token } = await createTestUser("owner3@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Doomed Board" });

    const res = await request(app)
      .delete(`/api/boards/${board.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it("blocks a non-owner member from deleting the board", async () => {
    const { token: ownerToken } = await createTestUser("owner4@example.com");
    const { token: memberToken, userId: memberId } = await createTestUser("member2@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Shared Board" });

    // Owner invites the second user as a regular member
    await request(app)
      .post(`/api/boards/${board.body.id}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member2@example.com" });

    const res = await request(app)
      .delete(`/api/boards/${board.body.id}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});

describe("Member removal - owner only", () => {
  it("blocks a non-owner from removing another member", async () => {
    const { token: ownerToken } = await createTestUser("owner5@example.com");
    const { token: memberToken, userId: memberId } = await createTestUser("member3@example.com");
    const { userId: thirdUserId } = await createTestUser("third@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Team Board" });

    await request(app)
      .post(`/api/boards/${board.body.id}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member3@example.com" });

    await request(app)
      .post(`/api/boards/${board.body.id}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "third@example.com" });

    // memberToken (not the owner) tries to remove the third user
    const res = await request(app)
      .delete(`/api/boards/${board.body.id}/members/${thirdUserId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it("prevents the owner from removing themselves", async () => {
    const { token: ownerToken, userId: ownerId } = await createTestUser("owner6@example.com");

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Solo Board" });

    const res = await request(app)
      .delete(`/api/boards/${board.body.id}/members/${ownerId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });
});