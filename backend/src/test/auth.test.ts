import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("POST /api/auth/signup", () => {
  it("creates a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
    // The response should never leak the password, hashed or otherwise
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Another User",
      email: "test@example.com",
      password: "different123",
    });

    expect(res.status).toBe(409);
  });

  it("rejects a password under 6 characters", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "short@example.com",
      password: "abc",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "login@example.com",
      password: "password123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("rejects an incorrect password", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "login2@example.com",
      password: "password123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "login2@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("rejects a nonexistent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "whatever123",
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/me", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns the user id for a valid token", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send({
      name: "Test User",
      email: "me@example.com",
      password: "password123",
    });
    const token = signupRes.body.token;

    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(signupRes.body.user.id);
  });
});
