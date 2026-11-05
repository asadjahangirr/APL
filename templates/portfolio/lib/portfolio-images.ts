import "server-only";
export {
  normalizeCmsImage,
  MAX_CMS_IMAGE_BYTES,
} from "./cms-image-codec.mjs";

export const PORTFOLIO_MEDIA_BUCKET = "cms-portfolio-media";
export const portfolioImageHeaders = {
  "Content-Type": "image/webp",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
