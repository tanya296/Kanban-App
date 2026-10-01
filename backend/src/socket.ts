import { Server as HTTPServer } from "http";
import { Server } from "socket.io";

let io: Server | null = null;

// Called once, when the server starts. Sets up Socket.io on top of
// our existing HTTP server, and defines what happens when a browser connects.
export function initSocket(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.CLIENT_URL || "http://localhost:5173").split(","),
    },
  });

  io.on("connection", (socket) => {
    // A browser tells us "I'm viewing this board" - we put them in a
    // "room" named after that board, so we can later send updates to
    // just the people looking at it, not every connected user.
    socket.on("join-board", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });
  });
}

// Lets our route files (boards.ts, lists.ts) grab this same io instance,
// so they can broadcast an update after a create/update/delete happens.
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized yet");
  }
  return io;
}