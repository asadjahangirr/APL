import { MAX_ASSET_BYTES, assetSchema, type Asset } from '../doc/schema';
import { newId } from '../doc/ops';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] as const;
/** Base64 adds ~33%, so the raw file must stay under ~3 MB to fit the asset limit. */
export const MAX_IMAGE_FILE_BYTES = Math.floor(MAX_ASSET_BYTES * 0.74);

export class ImageImportError extends Error {}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageImportError('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}
function dimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 300, height: image.naturalHeight || 150 });
    image.onerror = () => reject(new ImageImportError('That image could not be decoded.'));
    image.src = src;
  });
}

/** Validate and embed an image file as a document asset. */
export async function readImageFile(file: File): Promise<Asset> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) throw new ImageImportError('Use a PNG, JPEG, WebP, GIF or SVG image.');
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new ImageImportError(`Images must be under ${(MAX_IMAGE_FILE_BYTES / 1_000_000).toFixed(1)} MB.`);
  const dataUrl = await readDataUrl(file);
  const { width, height } = await dimensions(dataUrl);
  const parsed = assetSchema.safeParse({
    id: newId(), name: file.name.replace(/\.[^.]+$/, '').trim().slice(0, 120) || 'Image',
    mime: file.type, dataUrl, width: Math.min(20_000, Math.round(width)), height: Math.min(20_000, Math.round(height)),
  });
  if (!parsed.success) throw new ImageImportError('That image is not supported.');
  return parsed.data;
}
