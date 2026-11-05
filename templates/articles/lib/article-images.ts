import "server-only";
export {
  normalizeArticleImage,
  MAX_ARTICLE_IMAGE_BYTES,
} from "./article-image-codec.mjs";

export const ARTICLE_MEDIA_BUCKET = "cms-article-media";
export const articleImageHeaders = {
  "Content-Type": "image/webp",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
