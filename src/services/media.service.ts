import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { Media } from "../models/Media.js";

/**
 * Upload buffer to Cloudinary and register in Media collection.
 * Returns Media doc with url & publicId.
 */
export async function uploadImage(
  ownerId: string,
  file: Express.Multer.File,
  options?: { postId?: string; alt?: string; folder?: string; usage?: string },
): Promise<{ url: string; publicId: string; mediaId: string }> {
  const folder = options?.folder || "inkwell/covers";
  const usage = (options?.usage as string) || "cover";
  const publicId = `inkwell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await new Promise<{ secure_url: string; public_id: string; format: string; width: number; height: number; bytes: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
          // Optimization: auto format & quality, limit to 2000px to prevent huge originals
          transformation: [{ fetch_format: "auto", quality: "auto", width: 2000, crop: "limit" }],
        },
        (err, res) => {
          if (err || !res) return reject(err || new Error("Cloudinary upload failed"));
          resolve(res as never);
        },
      );
      stream.end(file.buffer);
    },
  );

  // If cloudinary not configured, mock for dev (fallback)
  // Cloudinary uploader will throw if not configured, so we catch above

  const media = await Media.create({
    owner: ownerId,
    post: options?.postId || null,
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: "image",
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    alt: options?.alt || "",
    folder,
    usage: usage as never,
  });

  return { url: result.secure_url, publicId: result.public_id, mediaId: String(media._id) };
}

/**
 * Fallback for dev without Cloudinary credentials: returns a placeholder that still
 * allows the editor to function. The URL is a picsum placeholder, but we still
 * create a Media doc for tracking.
 */
export async function uploadImagePlaceholder(
  ownerId: string,
  file: Express.Multer.File,
): Promise<{ url: string; publicId: string; mediaId: string }> {
  // If Cloudinary not configured, skip attempt and use placeholder directly
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
    const mockUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
    const mockPublicId = `mock_${Date.now()}`;
    const media = await Media.create({
      owner: ownerId,
      url: mockUrl,
      publicId: mockPublicId,
      resourceType: "image",
      format: file.mimetype.split("/")[1] || "jpeg",
      width: 1200,
      height: 800,
      bytes: file.size,
      alt: "",
      folder: "inkwell/covers",
      usage: "cover",
    });
    return { url: mockUrl, publicId: mockPublicId, mediaId: String(media._id) };
  }
  try {
    return await uploadImage(ownerId, file);
  } catch (err) {
    // Fallback: generate a mock URL and still create Media entry for dev
    const mockUrl = `https://picsum.photos/seed/${Date.now()}/1200/800`;
    const mockPublicId = `mock_${Date.now()}`;
    const media = await Media.create({
      owner: ownerId,
      url: mockUrl,
      publicId: mockPublicId,
      resourceType: "image",
      format: file.mimetype.split("/")[1] || "jpeg",
      width: 1200,
      height: 800,
      bytes: file.size,
      alt: "",
      folder: "inkwell/covers",
      usage: "cover",
    });
    return { url: mockUrl, publicId: mockPublicId, mediaId: String(media._id) };
  }
}

/** List media for authenticated user with search/filter/pagination */
export async function listUserMedia(
  ownerId: string,
  filter: { page: number; limit: number; search?: string; usage?: string; format?: string },
) {
  const query: Record<string, unknown> = { owner: ownerId };
  if (filter.usage) query["usage"] = filter.usage;
  if (filter.format) query["format"] = filter.format;
  if (filter.search) {
    const rx = { $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    query["$or"] = [{ publicId: rx }, { alt: rx }, { folder: rx }];
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Media.find(query)
      .select("url publicId resourceType format width height bytes alt usage folder createdAt post")
      .populate("post", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    Media.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

export async function getMediaById(id: string, ownerId?: string, isAdmin = false) {
  const media = await Media.findById(id)
    .populate("owner", "name email")
    .populate("post", "title slug")
    .lean();
  if (!media) {
    const { ApiError } = await import("../utils/ApiError.js");
    throw new ApiError(404, "Media not found");
  }
  // If owner check required and not admin, enforce
  if (ownerId && !isAdmin && String(media.owner) !== ownerId && String((media.owner as unknown as { _id: unknown })?._id ?? media.owner) !== ownerId) {
    // Also check populated owner
    const ownerStr = String((media.owner as unknown as { _id?: unknown })?._id ?? media.owner);
    if (ownerStr !== ownerId) {
      const { ApiError } = await import("../utils/ApiError.js");
      throw new ApiError(403, "You don't have permission to view this media");
    }
  }
  return media;
}

export async function updateMedia(
  id: string,
  ownerId: string,
  isAdmin: boolean,
  updates: { alt?: string; usage?: string; folder?: string },
) {
  const media = await Media.findById(id);
  if (!media) {
    const { ApiError } = await import("../utils/ApiError.js");
    throw new ApiError(404, "Media not found");
  }
  const isOwner = String(media.owner) === ownerId;
  if (!isOwner && !isAdmin) {
    const { ApiError } = await import("../utils/ApiError.js");
    throw new ApiError(403, "You don't have permission to edit this media");
  }
  if (updates.alt !== undefined) media.alt = updates.alt.slice(0, 200);
  if (updates.usage !== undefined) {
    const allowed = ["avatar", "cover", "post-body", "other"];
    if (allowed.includes(updates.usage)) media.usage = updates.usage as never;
  }
  if (updates.folder !== undefined) media.folder = updates.folder.slice(0, 120);
  await media.save();
  return media.toObject();
}

export async function deleteMediaWithAuth(id: string, ownerId: string, isAdmin: boolean) {
  const media = await Media.findById(id).select("publicId resourceType owner");
  if (!media) {
    const { ApiError } = await import("../utils/ApiError.js");
    throw new ApiError(404, "Media not found");
  }
  const isOwner = String(media.owner) === ownerId;
  if (!isOwner && !isAdmin) {
    const { ApiError } = await import("../utils/ApiError.js");
    throw new ApiError(403, "You don't have permission to delete this media");
  }
  await Media.deleteOne({ _id: id });
  try {
    await cloudinary.uploader.destroy(media.publicId, {
      resource_type: (media.resourceType ?? "image") as "image" | "video" | "raw",
    });
  } catch {
    // ignore cloudinary errors
  }
  return { deleted: true };
}
