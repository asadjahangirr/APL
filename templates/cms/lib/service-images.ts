import "server-only";
export {
  normalizeServiceImage,
  MAX_SERVICE_IMAGE_BYTES,
} from "./service-image-codec.mjs";

export const SERVICE_MEDIA_BUCKET = "cms-service-media";
export const serviceImageHeaders = {
  "Content-Type": "image/webp",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
