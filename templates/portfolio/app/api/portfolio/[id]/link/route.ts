import { database } from '../../../../../lib/server';
import { portfolioIdSchema, publishedPortfolioSchema } from '../../../../../lib/portfolio-schema';
import { portfolioTargetHref } from '../../../../../lib/portfolio-target';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = portfolioIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response('Invalid project.', { status: 400 });
  try {
    const result = await database().from('cms_portfolio_publications').select('payload').eq('id', parsed.data).maybeSingle();
    if (result.error) throw new Error('Unavailable');
    if (!result.data) return new Response('This project is not published.', { status: 404 });
    const payload = publishedPortfolioSchema.parse(result.data.payload);
    const href = payload.target ? portfolioTargetHref(payload.target) : payload.externalUrl;
    if (!href) return new Response('Project destination is unavailable.', { status: 404 });
    return new Response(null, { status: 307, headers: { Location: href, 'Cache-Control': 'no-store' } });
  } catch { return new Response('Portfolio setup is incomplete or content is unavailable.', { status: 503 }); }
}
