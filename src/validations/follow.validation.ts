import { z } from "zod";
import { usernameParams } from "./author.validation.js";

/** POST /follows/:username/toggle */
export const followToggleSchema = z.object({ params: usernameParams });

/** GET /follows/:username/state */
export const followStateSchema = z.object({ params: usernameParams });
