import { beforeEach } from "vitest";
import dotenv from "dotenv";
import path from "path";

// Load .env.test BEFORE anything else touches process.env, so Prisma
// connects to the test branch instead of your real dev database.
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

import { prisma } from "../config/db";

// Wipe all tables before every single test, in an order that respects
// foreign keys (children before parents) - otherwise deleting a User
// while a Board still references it would throw a constraint error.
beforeEach(async () => {
  await prisma.cardLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
});
import request from "supertest";
import { app } from "../index";

// Small helper so board/card tests don't have to repeat "sign up a user,
// pull out the token" in every single test - just call this and get both.
export async function createTestUser(email: string, name = "Test User") {
  const res = await request(app).post("/api/auth/signup").send({
    name,
    email,
    password: "password123",
  });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}