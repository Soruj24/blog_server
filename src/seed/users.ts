/**
 * Demo auth users (admin/author/editor). Idempotent: existing
 * emails are skipped; a real account holding the wanted
 * username is never stolen.
 */
import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { register } from "../services/auth.service.js";
import { DEMO_DOMAIN, DEMO_PASSWORD, DEMO_USERS, AUTHOR_BIOS } from "./data.js";

export async function seedUsers(fresh: boolean): Promise<void> {
  if (fresh) {
    const demoUsers = await User.find({ email: { $regex: `@inkwell\\.demo$` } }).select("_id");
    const ids = demoUsers.map((u) => u._id);
    await Profile.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log("[seed] removed previous demo users");
  }

  for (const demo of DEMO_USERS) {
    const exists = await User.exists({ email: demo.email });
    if (exists) {
      console.log(`[seed] user exists, skipping: ${demo.email}`);
      continue;
    }
    // A real (non-demo) account may already hold the username — e.g. a
    // previous seed with different emails. Never steal it, never crash.
    const usernameTaken = await Profile.exists({ username: demo.username });
    if (usernameTaken) {
      console.log(`[seed] username taken by a real account, skipping demo user: ${demo.email} (wanted username "${demo.username}")`);
      continue;
    }
    // First-ever user auto-becomes admin via register(); enforce demo roles explicitly.
    await register({ name: demo.name, email: demo.email, password: DEMO_PASSWORD, username: demo.username });
    await User.updateOne({ email: demo.email }, { role: demo.role });
    console.log(`[seed] created ${demo.role}: ${demo.email}`);
  }

  for (const [username, meta] of Object.entries(AUTHOR_BIOS)) {
    const user = await User.findOne({ email: `${username.split("_")[0]}${DEMO_DOMAIN}` }).select("_id");
    if (!user) continue;
    await Profile.updateOne(
      { user: user._id },
      {
        bio: meta.bio,
        avatarUrl: `https://picsum.photos/seed/${meta.avatarSeed}/200/200`,
        location: username === "maya_writes" ? "Berlin" : "Zurich",
        website: "https://inkwell.demo",
      },
    );
  }
}
