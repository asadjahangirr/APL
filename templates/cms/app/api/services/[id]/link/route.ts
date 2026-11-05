import { database } from '../../../../../lib/server';
import { serviceIdSchema, publishedServiceSchema } from '../../../../../lib/services-schema';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = serviceIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response('Invalid service.', { status: 400 });
  try {
    const result = await database().from('cms_service_publications').select('payload').eq('id', parsed.data).maybeSingle();
    if (result.error) throw new Error('Unavailable');
    if (!result.data) return new Response('This service is not published.', { status: 404 });
    const payload = publishedServiceSchema.parse(result.data.payload);
    return new Response(null, { status: 307, headers: { Location: '/services/' + payload.slug, 'Cache-Control': 'no-store' } });
  } catch { return new Response('Service setup is incomplete or content is unavailable.', { status: 503 }); }
}
