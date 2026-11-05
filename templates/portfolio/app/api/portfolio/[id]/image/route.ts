import { database, json } from "../../../../../lib/server";
import {
  portfolioIdSchema,
  publishedPortfolioSchema,
} from "../../../../../lib/portfolio-schema";
import {
  PORTFOLIO_MEDIA_BUCKET,
  portfolioImageHeaders,
} from "../../../../../lib/portfolio-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!portfolioIdSchema.safeParse(id).success)
    return json({ error: "Image not found." }, 404);
  try {
    const db = database();
    const publication = await db
      .from("cms_portfolio_publications")
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    if (publication.error)
      return json({ error: "Image storage is unavailable." }, 503);
    const payload = publishedPortfolioSchema.safeParse(publication.data?.payload);
    if (!payload.success || !payload.data.image)
      return json({ error: "Image not found." }, 404);
    const result = await db.storage
      .from(PORTFOLIO_MEDIA_BUCKET)
      .download(payload.data.image);
    if (result.error || !result.data)
      return json({ error: "Image not found." }, 404);
    // No browser/CDN cache: unpublishing must stop future public reads of this image.
    return new Response(result.data, { headers: portfolioImageHeaders });
  } catch {
    return json({ error: "Image storage is unavailable." }, 503);
  }
}
