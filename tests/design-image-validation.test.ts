import { describe, expect, it } from 'vitest';
import { readImageDimensions } from '../src/design/image-validation';

const url = (type: string, bytes: Uint8Array) => `data:image/${type};base64,${Buffer.from(bytes).toString('base64')}`;

describe('Embedded image dimensions before decoder allocation', () => {
  it('reads PNG dimensions directly, including oversized compressed-image headers', () => {
    const bytes = Buffer.alloc(33);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
    bytes.writeUInt32BE(13, 8); bytes.write('IHDR', 12); bytes.writeUInt32BE(12000, 16); bytes.writeUInt32BE(12000, 20);
    expect(readImageDimensions(url('png', bytes))).toEqual({ width: 12000, height: 12000 });
    expect(() => readImageDimensions(url('jpeg', bytes))).toThrow(/invalid or unsupported/);
  });

  it('reads JPEG SOF dimensions and honors bounded EXIF rotation', () => {
    const frame = Buffer.from([255, 192, 0, 11, 8, 0, 20, 0, 30, 1, 1, 17, 0]);
    expect(readImageDimensions(url('jpeg', Buffer.concat([Buffer.from([255, 216]), frame])))).toEqual({ width: 30, height: 20 });
    const exif = Buffer.alloc(36);
    exif[0] = 255; exif[1] = 225; exif.writeUInt16BE(34, 2); exif.write('Exif\0\0', 4);
    exif.write('II', 10); exif.writeUInt16LE(42, 12); exif.writeUInt32LE(8, 14); exif.writeUInt16LE(1, 18);
    exif.writeUInt16LE(0x112, 20); exif.writeUInt16LE(3, 22); exif.writeUInt32LE(1, 24); exif.writeUInt16LE(6, 28);
    expect(readImageDimensions(url('jpeg', Buffer.concat([Buffer.from([255, 216]), exif, frame])))).toEqual({ width: 20, height: 30 });
    exif.writeUInt32LE(0xffffffff, 14);
    expect(readImageDimensions(url('jpeg', Buffer.concat([Buffer.from([255, 216]), exif, frame])))).toEqual({ width: 30, height: 20 });
  });

  it('reads extended, lossy and lossless WebP sizes', () => {
    const bytes = Buffer.alloc(30);
    bytes.write('RIFF', 0); bytes.write('WEBP', 8); bytes.write('VP8X', 12); bytes[24] = 99; bytes[27] = 49;
    expect(readImageDimensions(url('webp', bytes))).toEqual({ width: 100, height: 50 });
    bytes.write('VP8 ', 12); bytes[23] = 157; bytes[24] = 1; bytes[25] = 42; bytes.writeUInt16LE(320, 26); bytes.writeUInt16LE(180, 28);
    expect(readImageDimensions(url('webp', bytes))).toEqual({ width: 320, height: 180 });
    bytes.write('VP8L', 12); bytes[20] = 47; bytes[21] = 99; bytes[22] = 0x40; bytes[23] = 12; bytes[24] = 0;
    expect(readImageDimensions(url('webp', bytes))).toEqual({ width: 100, height: 50 });
  });

  it('rejects corrupt/truncated content and unsupported sources without invoking a browser decoder', () => {
    expect(() => readImageDimensions('data:image/png;base64,YWJjZA==')).toThrow(/invalid or unsupported/);
    expect(() => readImageDimensions('https://example.test/image.png')).toThrow(/embedded/);
    expect(() => readImageDimensions(url('jpeg', Buffer.from([255, 216, 255, 225, 255, 255])))).toThrow(/invalid or unsupported/);
    expect(() => readImageDimensions('data:image/svg+xml;base64,YWJjZA==')).toThrow(/embedded/);
  });
});
