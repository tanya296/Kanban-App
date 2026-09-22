import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import { requireAuth, AuthRequest } from "./middleware/auth";
import boardsRouter from "./routes/boards";
import listsRouter from "./routes/lists";
import { initSocket } from "./socket";

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/boards", boardsRouter);
app.use("/api/lists", listsRouter);

app.get("/api/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ userId: req.userId });
});

app.get("/", (_req, res) => {
  res.send("Kanban API is running");
});

// Socket.io needs the raw HTTP server underneath Express, not the
// Express app object itself - Express normally hides this detail from
// you, so we create it explicitly here instead of using app.listen().
const httpServer = createServer(app);

initSocket(httpServer);

// Only actually start listening when this file is run directly (npm run dev/start),
// not when it's imported by test files via supertest - otherwise every test run
// would try to bind port 4000 and clash with your already-running dev server.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}