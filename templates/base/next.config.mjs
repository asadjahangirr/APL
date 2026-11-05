import { fileURLToPath } from 'node:url';
const backendOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : '';
export default {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  output: process.env.NEXT_BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' " + backendOrigin + "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
    ] }];
  }
};
