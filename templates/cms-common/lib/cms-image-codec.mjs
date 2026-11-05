import sharp from "sharp";

export const MAX_CMS_IMAGE_BYTES = 2 * 1024 * 1024;
/** @param {Uint8Array} bytes @param {string} contentType */
export async function normalizeCmsImage(bytes, contentType) {
  /** @type {Record<string, string>} */
  const types = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
  };
  if (
    !Object.hasOwn(types, contentType) ||
    !bytes.length ||
    bytes.length > MAX_CMS_IMAGE_BYTES
  )
    throw new Error("INVALID_IMAGE");
  const image = sharp(bytes, {
    limitInputPixels: 24000000,
    failOn: "warning",
    animated: false,
  });
  const metadata = await image.metadata();
  if (
    metadata.format !== types[contentType] ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error("INVALID_IMAGE");
  // Decode pixels; discard the original file, metadata, and embedded payloads.
  const output = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  if (output.length > MAX_CMS_IMAGE_BYTES) throw new Error("INVALID_IMAGE");
  return output;
}
