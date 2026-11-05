import { database } from '../../../../../lib/server';
import { articleIdSchema, publishedArticleSchema } from '../../../../../lib/articles-schema';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = articleIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response('Invalid article.', { status: 400 });
  try {
    const result = await database().from('cms_article_publications').select('payload').eq('id', parsed.data).maybeSingle();
    if (result.error) throw new Error('Unavailable');
    if (!result.data) return new Response('This article is not published.', { status: 404 });
    const payload = publishedArticleSchema.parse(result.data.payload);
    return new Response(null, { status: 307, headers: { Location: '/articles/' + payload.slug, 'Cache-Control': 'no-store' } });
  } catch { return new Response('Article setup is incomplete or content is unavailable.', { status: 503 }); }
}
