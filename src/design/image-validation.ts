/** Inspect encoded dimensions before handing a compressed bitmap to a decoder. */
export function embeddedImageDimensions(dataUrl: string): { width: number; height: number } {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || dataUrl.length > 3_000_000) throw new Error('Choose an embedded PNG, JPEG or WebP image up to 2 MB.');
  let binary: string;
  try { binary = atob(match[2]); } catch { throw new Error('The embedded image is not valid base64.'); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const text = (start: number, count: number) => String.fromCharCode(...bytes.subarray(start, start + count));
  let width = 0, height = 0;
  if (match[1] === 'png') {
    if (bytes.length >= 33 && bytes[0] === 137 && text(1, 3) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 && text(12, 4) === 'IHDR' && view.getUint32(8) === 13) {
      width = view.getUint32(16);
      height = view.getUint32(20);
    }
  } else if (match[1] === 'jpeg') {
    if (bytes[0] === 255 && bytes[1] === 216) {
      let offset = 2;
      let orientation = 1;
      const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
      while (offset < bytes.length) {
        if (bytes[offset++] !== 255) break;
        while (bytes[offset] === 255) offset += 1;
        const marker = bytes[offset++];
        if (marker === 0xda || marker === 0xd9 || marker === 0) break;
        if (marker === 1 || (marker >= 0xd0 && marker <= 0xd8)) continue;
        if (offset + 2 > bytes.length) break;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        // Browsers honor EXIF orientation; rotated JPEGs expose swapped natural
        // dimensions. Read only the bounded TIFF orientation entry.
        if (marker === 0xe1 && length >= 16 && text(offset + 2, 6) === 'Exif\u0000\u0000') {
          const tiff = offset + 8;
          const endian = text(tiff, 2);
          const little = endian === 'II';
          if ((little || endian === 'MM') && view.getUint16(tiff + 2, little) === 42) {
            const directory = tiff + view.getUint32(tiff + 4, little);
            const end = offset + length;
            if (directory >= tiff && directory + 2 <= end) {
              const count = Math.min(view.getUint16(directory, little), 512);
              for (let index = 0; index < count; index += 1) {
                const entry = directory + 2 + index * 12;
                if (entry + 12 > end) break;
                if (view.getUint16(entry, little) === 0x112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
                  orientation = view.getUint16(entry + 8, little);
                  break;
                }
              }
            }
          }
        }
        if (frameMarkers.has(marker) && length >= 8) {
          height = view.getUint16(offset + 3);
          width = view.getUint16(offset + 5);
          if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
          break;
        }
        offset += length;
      }
    }
  } else if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const kind = text(12, 4);
    if (kind === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    }
  }
  if (!width || !height) throw new Error('This image has an invalid or unsupported image header.');
  return { width, height };
}

export const readImageDimensions = embeddedImageDimensions;
