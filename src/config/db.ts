import mongoose from "mongoose";
import { env } from "./env.js";

/** Connect once at boot. Models (Phase 2) reuse this connection. */
export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[db] connected (${env.NODE_ENV})`);
}
