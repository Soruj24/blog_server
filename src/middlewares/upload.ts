import type { NextFunction, Request, Response } from "express";
import multer from "multer";

// Memory storage — we stream to Cloudinary, no temp files
const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG, WebP, GIF, and AVIF images are allowed"));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/** Verify magic bytes to prevent mimetype spoofing */
function isValidImage(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  const sig = buffer.subarray(0, 12);
  if (mimetype === "image/jpeg" && sig[0] === 0xff && sig[1] === 0xd8) return true;
  if (mimetype === "image/png" && sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return true;
  if (mimetype === "image/gif" && sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46) return true;
  if (mimetype === "image/webp" && sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50) return true;
  if (mimetype === "image/avif" && sig.subarray(4, 8).toString() === "ftyp") return true;
  return false;
}

// Wrapper to handle multer errors gracefully + magic byte check
export function uploadSingle(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const handler = upload.single(field);
    handler(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next({ status: 400, message: "Image must be smaller than 5MB" });
          }
          return next({ status: 400, message: err.message });
        }
        return next({ status: 400, message: err.message });
      }
      const file = (req as unknown as { file?: Express.Multer.File }).file;
      if (file && !isValidImage(file.buffer, file.mimetype)) {
        return next({ status: 400, message: "Invalid image file (signature mismatch)" });
      }
      next();
    });
  };
}
