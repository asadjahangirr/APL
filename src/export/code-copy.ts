export function decodeCodeFile(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export async function copyCode(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable in this browser. Download the bundle to keep these files.');
  try { await navigator.clipboard.writeText(text); }
  catch { throw new Error('The browser did not allow clipboard access. Download the bundle or select and copy the source manually.'); }
}
