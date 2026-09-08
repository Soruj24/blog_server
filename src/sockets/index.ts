import type { Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env.js";

let ioInstance: SocketServer | null = null;

export function getIO(): SocketServer | null {
  return ioInstance;
}

/** Emit to a single user's inbox room (best-effort) */
export function emitToUser(userId: string, event: string, payload: unknown) {
  try {
    ioInstance?.to(`user:${userId}`).emit(event, payload);
  } catch {
    // never break the action that triggered the notification
  }
}

export function emitNotification(recipientId: string, notification: unknown) {
  emitToUser(String(recipientId), "notification:new", notification);
}

/**
 * Socket.io — per-user rooms + JWT auth.
 * Client sends auth token, server verifies AUTH_SECRET and joins user:<id>
 */
export function initSockets(httpServer: Server): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });
  ioInstance = io;

  // Auth middleware: optional — unauthenticated sockets still connect but join no room
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string } | undefined)?.token ||
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);
      if (!token) return next();
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(env.AUTH_SECRET);
      const { payload } = await jwtVerify(token, secret);
      if (payload.sub) {
        (socket.data as { userId?: string }).userId = payload.sub;
      }
    } catch {
      // Invalid token — allow connection without room
    }
    next();
  });

  io.on("connection", (socket) => {
    const userId = (socket.data as { userId?: string }).userId;
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[socket] user:${userId} joined ${socket.id}`);
    } else {
      console.log(`[socket] anon ${socket.id}`);
    }
    socket.on("disconnect", () => console.log(`[socket] left ${socket.id}`));
  });

  return io;
}
