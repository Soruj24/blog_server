import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Some routers/firewalls silently drop DNS TXT queries (A/SRV still resolve).
 * For `mongodb+srv://` URIs the driver resolves the SRV record *and* a TXT
 * record, then awaits both — a dropped TXT query has no timeout, so
 * `mongoose.connect()` hangs for minutes with no error. The TXT record only
 * carries optional hints (`authSource`, `replicaSet`, `loadBalanced`), so cap
 * the lookup and continue without it.
 */
let patchedDnsTxt = false;

function tolerateDroppedDnsTxtQueries(timeoutMs = 2000): void {
  if (patchedDnsTxt) return;
  patchedDnsTxt = true;

  const resolve = dns.promises.resolve.bind(dns.promises);

  dns.promises.resolve = ((
    hostname: string,
    rrtype?: string,
  ): Promise<unknown> => {
    if (rrtype !== "TXT") {
      return (resolve as (h: string, t?: string) => Promise<unknown>)(hostname, rrtype);
    }

    return Promise.race([
      resolve(hostname, "TXT"),
      new Promise<never>((_, fail) => {
        // The driver treats ENODATA as "no TXT hints" and connects anyway.
        setTimeout(() => {
          fail(Object.assign(new Error("DNS TXT query timed out"), { code: "ENODATA" }));
        }, timeoutMs).unref();
      }),
    ]);
  }) as typeof dns.promises.resolve;
}

/** Connect once at boot. Models (Phase 2) reuse this connection. */
export async function connectDB(): Promise<void> {
  tolerateDroppedDnsTxtQueries();
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[db] connected (${env.NODE_ENV})`);
}
