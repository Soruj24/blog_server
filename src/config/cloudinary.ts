import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

/** Cloudinary is configured lazily — uploads arrive in Phase 3 (articles). */
export function initCloudinary(): void {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    console.log("[media] cloudinary not configured — uploads disabled");
    return;
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  console.log("[media] cloudinary configured");
}

export { cloudinary };
