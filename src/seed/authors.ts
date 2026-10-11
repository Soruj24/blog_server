/**
 * The 20 staff-writer profiles. Fully idempotent: an existing
 * account with the same email (or a real account holding the
 * username) is skipped, never duplicated or overwritten.
 */
import { randomUUID } from "node:crypto";
import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { register } from "../services/auth.service.js";
import { AUTHORS, DEMO_DOMAIN } from "./data.js";

export async function seedAuthors(): Promise<void> {
  let created = 0;
  let skipped = 0;
  for (const a of AUTHORS) {
    const email = `${a.username}${DEMO_DOMAIN}`;
    const exists = await User.exists({ email });
    if (exists) {
      console.log(`[seed] author exists, skipping: ${email}`);
      skipped += 1;
      continue;
    }
    const usernameTaken = await Profile.exists({ username: a.username });
    if (usernameTaken) {
      console.log(`[seed] username taken by a real account, skipping demo author: ${email}`);
      skipped += 1;
      continue;
    }
    // Random, unrecorded password: demo authors are content attributions,
    // not login accounts. register() also creates the linked Profile.
    await register({ name: a.name, email, password: randomUUID(), username: a.username });
    await User.updateOne({ email }, { role: "author", status: "active" });
    const user = await User.findOne({ email }).select("_id");
    if (!user) throw new Error(`author user missing after register: ${email}`);
    await Profile.updateOne(
      { user: user._id },
      {
        displayName: a.name,
        title: a.title,
        bio: a.bio,
        expertise: a.expertise,
        location: a.location,
        avatarUrl: `https://picsum.photos/seed/inkwell-${a.username}/200/200`,
      },
    );
    console.log(`[seed] author: ${a.username}`);
    created += 1;
  }
  console.log(`[seed] authors: ${created} created, ${skipped} already present`);
}
