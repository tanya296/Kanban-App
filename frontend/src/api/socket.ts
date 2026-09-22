import { io } from "socket.io-client";

// One shared socket connection for the whole app, created once.
export const socket = io("http://localhost:4000");