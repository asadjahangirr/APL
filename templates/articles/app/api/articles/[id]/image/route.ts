import { database, json } from "../../../../../lib/server";
import {
  articleIdSchema,
  publishedArticleSchema,
} from "../../../../../lib/articles-schema";
import {
  ARTICLE_MEDIA_BUCKET,
  articleImageHeaders,
} from "../../../../../lib/article-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!articleIdSchema.safeParse(id).success)
    return json({ error: "Image not found." }, 404);
  try {
    const db = database();
    const publication = await db
      .from("cms_article_publications")
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    if (publication.error)
      return json({ error: "Image storage is unavailable." }, 503);
    const payload = publishedArticleSchema.safeParse(publication.data?.payload);
    if (!payload.success || !payload.data.image)
      return json({ error: "Image not found." }, 404);
    const result = await db.storage
      .from(ARTICLE_MEDIA_BUCKET)
      .download(payload.data.image);
    if (result.error || !result.data)
      return json({ error: "Image not found." }, 404);
    // No browser/CDN cache: unpublishing must stop future public reads of this image.
    return new Response(result.data, { headers: articleImageHeaders });
  } catch {
    return json({ error: "Image storage is unavailable." }, 503);
  }
}
